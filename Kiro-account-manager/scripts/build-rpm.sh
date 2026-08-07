#!/bin/bash
# build-rpm.sh - Build and optionally install the Kiro Account Manager RPM
#
# Usage:
#   ./scripts/build-rpm.sh          # build only
#   ./scripts/build-rpm.sh install  # build + install
#
# Requirements:
#   - rpmbuild (rpm-build package)
#   - bun (for JS build)
#   - The project must be built first (bun run build:unpack)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VERSION=$(grep '"version"' "$PROJECT_DIR/package.json" | head -1 | sed 's/.*"\([0-9.]*\)".*/\1/')
BUILD_DIR="/tmp/kiro-rpm-build"
DIST_DIR="$PROJECT_DIR/dist/linux-unpacked"

echo "=== Kiro Account Manager RPM Builder ==="
echo "Version: $VERSION"
echo "Project: $PROJECT_DIR"

# Step 1: Build the app
echo ""
echo "[1/3] Building app..."
cd "$PROJECT_DIR"
bun run build:unpack

# Verify the binary was renamed correctly
if [ ! -f "$DIST_DIR/kiro-account-manager" ]; then
  echo "ERROR: $DIST_DIR/kiro-account-manager not found!"
  echo "electron-builder did not rename the binary. Check executableName in electron-builder.yml"
  exit 1
fi

# Step 2: Build RPM
echo ""
echo "[2/3] Building RPM..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"/{BUILD,RPMS,SPECS,SOURCES}

cat > "$BUILD_DIR/SPECS/kiro-account-manager.spec" << SPECEOF
Name:           kiro-account-manager
Version:        $VERSION
Release:        1%{?dist}
Summary:        Kiro Account Manager
License:        AGPL-3.0
URL:            https://kiro.dev
AutoReqProv:    no

# Disable stripping - Electron binaries break if stripped
%global __os_install_post %{nil}
%global __strip /bin/true
%define debug_package %{nil}

%description
Kiro Account Manager - Manage your Kiro accounts, usage and subscriptions

%install
mkdir -p %{buildroot}/opt/kiro-account-manager
cp -a $DIST_DIR/* %{buildroot}/opt/kiro-account-manager/
mkdir -p %{buildroot}/usr/bin
cat > %{buildroot}/usr/bin/kiro-account-manager << 'WRAPPER'
#!/bin/bash
exec /opt/kiro-account-manager/kiro-account-manager --no-sandbox "\$@"
WRAPPER
chmod +x %{buildroot}/usr/bin/kiro-account-manager
mkdir -p %{buildroot}/usr/share/icons/hicolor/256x256/apps
cp $PROJECT_DIR/build/icon.png %{buildroot}/usr/share/icons/hicolor/256x256/apps/kiro-account-manager.png
mkdir -p %{buildroot}/usr/share/applications
cat > %{buildroot}/usr/share/applications/kiro-account-manager.desktop << 'DESKTOP'
[Desktop Entry]
Name=Kiro Account Manager
Comment=Manage your Kiro accounts
Exec=kiro-account-manager %U
Terminal=false
Type=Application
Icon=kiro-account-manager
StartupWMClass=kiro-account-manager
MimeType=x-scheme-handler/kiro;
Categories=Utility;
DESKTOP

%post
if [ -f /opt/kiro-account-manager/chrome-sandbox ]; then
  chown root:root /opt/kiro-account-manager/chrome-sandbox
  chmod 4755 /opt/kiro-account-manager/chrome-sandbox
fi
update-desktop-database /usr/share/applications 2>/dev/null || true
gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true

%postun
update-desktop-database /usr/share/applications 2>/dev/null || true

%files
/opt/kiro-account-manager
/usr/bin/kiro-account-manager
/usr/share/icons/hicolor/256x256/apps/kiro-account-manager.png
/usr/share/applications/kiro-account-manager.desktop
SPECEOF

rpmbuild -bb \
  --define "_topdir $BUILD_DIR" \
  --define "_rpmdir $BUILD_DIR/RPMS" \
  --define "_tmppath /tmp" \
  "$BUILD_DIR/SPECS/kiro-account-manager.spec"

RPM_FILE=$(find "$BUILD_DIR/RPMS" -name "*.rpm" | head -1)
echo ""
echo "RPM built: $RPM_FILE"
echo "Size: $(du -h "$RPM_FILE" | cut -f1)"

# Step 3: Install if requested
if [ "${1:-}" = "install" ]; then
  echo ""
  echo "[3/3] Installing RPM..."
  sudo rpm -Uvh --force "$RPM_FILE"
  echo ""
  echo "Installed! Launch via app menu or: kiro-account-manager"
else
  echo ""
  echo "To install: sudo rpm -Uvh --force $RPM_FILE"
fi
