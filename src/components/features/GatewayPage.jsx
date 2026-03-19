import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Copy, Play, Square, Activity, Shield, Server, RefreshCw, Radio, Check, RotateCcw, FolderOpen } from 'lucide-react'
import { Alert, Button, Card, Group, Stack, Text, TextInput, Textarea, NumberInput, Select, Badge, Code, Tooltip, Switch } from '@mantine/core'
import { useApp } from '../../hooks/useApp'

const DEFAULT_CONFIG = {
  enabled: false,
  host: '127.0.0.1',
  port: 8765,
  apiKey: '',
  region: 'us-east-1',
  accountMode: 'local',
  accountId: null,
  groupId: null,
  tagId: null,
  strategy: 'round_robin',
  threshold: 90,
  localOnly: true,
  allowedIpsText: '',
  logLevel: 'debug',
}

const parseAllowedIps = (value) => String(value || '')
  .split(/[\n,]+/)
  .map(item => item.trim())
  .filter(Boolean)

function GatewayPage() {
  const { colors } = useApp()
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [status, setStatus] = useState({ running: false, host: '127.0.0.1', port: 8765, requestCount: 0, lastError: null })
  const [errors, setErrors] = useState([])
  const [streamErrors, setStreamErrors] = useState([])
  const [accounts, setAccounts] = useState([])
  const [groups, setGroups] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copySuccess, setCopySuccess] = useState('')
  const [logDir, setLogDir] = useState('')

  const accountOptions = useMemo(
    () => accounts.map(account => ({
      value: account.id,
      label: `${account.label || account.email || account.userId || account.id} (${account.status || 'unknown'})`,
    })),
    [accounts]
  )

  const groupOptions = useMemo(
    () => groups.map(group => ({ value: group.id, label: group.name })),
    [groups]
  )

  const tagOptions = useMemo(
    () => tags.map(tag => ({ value: tag.id, label: tag.name })),
    [tags]
  )

  const baseUrl = useMemo(() => `http://${config.host}:${config.port}`, [config.host, config.port])

  const pushError = (msg) => {
    setErrors(prev => [String(msg), ...prev].slice(0, 5))
  }

  const pushStreamError = (msg) => {
    if (!msg) return
    setStreamErrors(prev => [String(msg), ...prev].slice(0, 8))
  }

  const loadAll = async () => {
    setLoading(true)
    try {
      const [gatewayConfig, gatewayStatus, accountList, groupList, tagList, gatewayLogDir] = await Promise.all([
        invoke('get_gateway_config'),
        invoke('get_gateway_status'),
        invoke('get_accounts'),
        invoke('get_groups'),
        invoke('get_tags'),
        invoke('get_gateway_log_dir'),
      ])

      setConfig({
        enabled: gatewayConfig?.enabled ?? false,
        host: gatewayConfig?.host || '127.0.0.1',
        port: gatewayConfig?.port || 8765,
        apiKey: gatewayConfig?.access_token || gatewayConfig?.accessToken || '',
        region: gatewayConfig?.region || 'us-east-1',
        accountMode: gatewayConfig?.account_mode || gatewayConfig?.accountMode || 'local',
        accountId: gatewayConfig?.account_id || gatewayConfig?.accountId || null,
        groupId: gatewayConfig?.group_id || gatewayConfig?.groupId || null,
        tagId: gatewayConfig?.tag_id || gatewayConfig?.tagId || null,
        strategy: gatewayConfig?.strategy || 'round_robin',
        threshold: gatewayConfig?.threshold ?? 90,
        localOnly: gatewayConfig?.local_only ?? gatewayConfig?.localOnly ?? true,
        allowedIpsText: Array.isArray(gatewayConfig?.allowed_ips || gatewayConfig?.allowedIps)
          ? (gatewayConfig.allowed_ips || gatewayConfig.allowedIps).join('\n')
          : '',
        logLevel: gatewayConfig?.log_level || gatewayConfig?.logLevel || 'debug',
      })

      setStatus({
        running: gatewayStatus?.running ?? false,
        host: gatewayStatus?.host || gatewayConfig?.host || '127.0.0.1',
        port: gatewayStatus?.port || gatewayConfig?.port || 8765,
        requestCount: gatewayStatus?.requestCount || 0,
        lastError: gatewayStatus?.lastError || null,
      })

      setAccounts(Array.isArray(accountList) ? accountList : [])
      setGroups(Array.isArray(groupList) ? groupList : [])
      setTags(Array.isArray(tagList) ? tagList : [])
      setLogDir(String(gatewayLogDir || ''))

      if (gatewayStatus?.lastError) {
        pushError(gatewayStatus.lastError)
        pushStreamError(gatewayStatus.lastError)
      }
    } catch (e) {
      pushError(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    const timer = setInterval(() => {
      invoke('get_gateway_status')
        .then((st) => {
          setStatus({
            running: st?.running ?? false,
            host: st?.host || config.host,
            port: st?.port || config.port,
            requestCount: st?.requestCount || 0,
            lastError: st?.lastError || null,
          })
          if (st?.lastError) {
            pushError(st.lastError)
            pushStreamError(st.lastError)
          }
        })
        .catch(() => {})
    }, 2000)

    return () => clearInterval(timer)
  }, [])

  const setField = (key, value) => setConfig(prev => ({ ...prev, [key]: value }))

  const handleRefresh = async () => {
    await loadAll()
  }

  const handleGenerateApiKey = () => {
    const random = crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now()}${Math.random().toString(36).slice(2)}`
    setConfig(prev => ({ ...prev, apiKey: `sk-${random}` }))
  }

  const handleOpenLogDir = async () => {
    try {
      const dir = await invoke('open_gateway_log_dir')
      setLogDir(String(dir || ''))
    } catch (e) {
      pushError(e)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await invoke('save_gateway_config', {
        config: {
          enabled: config.enabled,
          host: config.host,
          port: Number(config.port),
          accessToken: config.apiKey || null,
          region: config.region,
          accountMode: config.accountMode,
          accountId: config.accountId || null,
          groupId: config.groupId || null,
          tagId: config.tagId || null,
          strategy: config.strategy,
          threshold: Number(config.threshold) || 90,
          localOnly: !!config.localOnly,
          allowedIps: parseAllowedIps(config.allowedIpsText),
          logLevel: config.logLevel,
        },
      })
    } catch (e) {
      pushError(e)
    } finally {
      setSaving(false)
    }
  }

  const handleStart = async () => {
    setSaving(true)
    try {
      const st = await invoke('start_gateway', {
        config: {
          enabled: true,
          host: config.host,
          port: Number(config.port),
          accessToken: config.apiKey || null,
          region: config.region,
          accountMode: config.accountMode,
          accountId: config.accountId || null,
          groupId: config.groupId || null,
          tagId: config.tagId || null,
          strategy: config.strategy,
          threshold: Number(config.threshold) || 90,
          localOnly: !!config.localOnly,
          allowedIps: parseAllowedIps(config.allowedIpsText),
          logLevel: config.logLevel,
        },
      })
      setStatus(st)
      setConfig(prev => ({ ...prev, enabled: true }))
    } catch (e) {
      pushError(e)
    } finally {
      setSaving(false)
    }
  }

  const handleRestart = async () => {
    setSaving(true)
    try {
      if (status.running) {
        await invoke('stop_gateway')
      }
      const st = await invoke('start_gateway', {
        config: {
          enabled: true,
          host: config.host,
          port: Number(config.port),
          accessToken: config.apiKey || null,
          region: config.region,
          accountMode: config.accountMode,
          accountId: config.accountId || null,
          groupId: config.groupId || null,
          tagId: config.tagId || null,
          strategy: config.strategy,
          threshold: Number(config.threshold) || 90,
          localOnly: !!config.localOnly,
          allowedIps: parseAllowedIps(config.allowedIpsText),
          logLevel: config.logLevel,
        },
      })
      setStatus(st)
      setConfig(prev => ({ ...prev, enabled: true }))
    } catch (e) {
      pushError(e)
    } finally {
      setSaving(false)
    }
  }

  const handleStop = async () => {
    setSaving(true)
    try {
      await invoke('stop_gateway')
      setStatus(prev => ({ ...prev, running: false }))
      setConfig(prev => ({ ...prev, enabled: false }))
    } catch (e) {
      pushError(e)
    } finally {
      setSaving(false)
    }
  }

  const copyClientConfig = async () => {
    try {
      const text = `ANTHROPIC_BASE_URL=${baseUrl}\nANTHROPIC_API_KEY=${config.apiKey || 'sk-your-gateway-api-key'}\nOPENAI_BASE_URL=${baseUrl}\nOPENAI_API_KEY=${config.apiKey || 'sk-your-gateway-api-key'}\n# OpenAI 客户端优先使用 /v1/responses，兼容 /v1/chat/completions`
      await navigator.clipboard.writeText(text)
      setCopySuccess('客户端配置已复制')
      setTimeout(() => setCopySuccess(''), 1600)
    } catch (e) {
      pushError(e)
    }
  }

  return (
    <div className={`h-full overflow-y-auto p-6 ${colors.main}`}>
      <Stack gap="md">
        <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
          <Text fw={700} className={colors.text}>Kiro API 网关</Text>
          <Text size="sm" className={colors.textMuted} mt={6}>本地代理仅转发至 Kiro API，不经过任何第三方服务器。Kiro access token 从本地账号自动读取，页面里填写的是客户端 API Key。</Text>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
            <Stack gap="sm">
              <Group gap="xs"><Server size={16} /><Text fw={600} className={colors.text}>网关配置</Text></Group>

              <TextInput
                label="监听地址"
                value={config.host}
                onChange={(e) => setField('host', e.currentTarget.value || '127.0.0.1')}
              />

              <NumberInput
                label="端口"
                value={config.port}
                min={1}
                max={65535}
                onChange={(v) => setField('port', Number(v) || 8765)}
              />

              <TextInput
                label="客户端 API Key"
                description="客户端连接本地网关时使用。Kiro API 的 access token 由网关从本地账号自动读取。"
                placeholder="sk-..."
                value={config.apiKey}
                onChange={(e) => setField('apiKey', e.currentTarget.value)}
                rightSection={
                  <Tooltip label="生成一个 sk- 格式的 API Key">
                    <Button size="xs" variant="subtle" onClick={handleGenerateApiKey}>生成</Button>
                  </Tooltip>
                }
              />

              <Select
                label="Region"
                data={[
                  { value: 'us-east-1', label: 'us-east-1' },
                  { value: 'eu-central-1', label: 'eu-central-1' },
                ]}
                value={config.region}
                onChange={(v) => setField('region', v || 'us-east-1')}
              />

              <Select
                label="账号来源"
                data={[
                  { value: 'local', label: '本地 Kiro 登录态' },
                  { value: 'single', label: '指定单账号' },
                  { value: 'group', label: '按分组账号池' },
                  { value: 'tag', label: '按标签账号池' },
                ]}
                value={config.accountMode}
                onChange={(v) => setField('accountMode', v || 'local')}
              />

              {config.accountMode === 'single' ? (
                <Select
                  searchable
                  label="指定账号"
                  placeholder="选择一个账号"
                  data={accountOptions}
                  value={config.accountId}
                  onChange={(v) => setField('accountId', v)}
                />
              ) : null}

              {config.accountMode === 'group' ? (
                <Select
                  searchable
                  label="账号分组"
                  placeholder="选择一个分组"
                  data={groupOptions}
                  value={config.groupId}
                  onChange={(v) => setField('groupId', v)}
                />
              ) : null}

              {config.accountMode === 'tag' ? (
                <Select
                  searchable
                  label="账号标签"
                  placeholder="选择一个标签"
                  data={tagOptions}
                  value={config.tagId}
                  onChange={(v) => setField('tagId', v)}
                />
              ) : null}

              {config.accountMode !== 'local' ? (
                <>
                  <Select
                    label="账号策略"
                    data={[
                      { value: 'round_robin', label: '轮询 round_robin' },
                      { value: 'most_quota', label: '优先剩余额度 most_quota' },
                      { value: 'random', label: '随机 random' },
                    ]}
                    value={config.strategy}
                    onChange={(v) => setField('strategy', v || 'round_robin')}
                  />

                  <NumberInput
                    label="切换阈值"
                    description="当账号使用率达到该阈值且仍有其他候选账号时，网关会优先尝试下一个账号。"
                    value={config.threshold}
                    min={1}
                    max={100}
                    onChange={(v) => setField('threshold', Number(v) || 90)}
                  />
                </>
              ) : null}

              <Switch
                label="随应用启动自动拉起网关"
                description="仅影响下次启动应用时是否自动启动，不会立即修改当前运行状态。"
                checked={!!config.enabled}
                onChange={(e) => setField('enabled', e.currentTarget.checked)}
              />

              <Switch
                label="仅允许本机访问"
                description="开启后，网关会拒绝非 127.0.0.1 / ::1 请求，即使你把监听地址改成 0.0.0.0。"
                checked={!!config.localOnly}
                onChange={(e) => setField('localOnly', e.currentTarget.checked)}
              />

              <Textarea
                label="IP 白名单"
                description="支持单个 IP 或 CIDR，每行或逗号分隔；仅在关闭“仅允许本机访问”后生效。"
                placeholder={'192.168.1.10\n10.0.0.0/24'}
                autosize
                minRows={3}
                value={config.allowedIpsText}
                onChange={(e) => setField('allowedIpsText', e.currentTarget.value)}
              />

              <Select
                label="日志级别"
                description="控制应用日志插件级别；保存后需重启应用才能完全生效。"
                data={[
                  { value: 'debug', label: 'debug' },
                  { value: 'info', label: 'info' },
                  { value: 'warn', label: 'warn' },
                  { value: 'error', label: 'error' },
                ]}
                value={config.logLevel}
                onChange={(v) => setField('logLevel', v || 'debug')}
              />

              <Alert color="orange" variant="light" title="风险提示">
                该网关会直接使用本地或托管账号的 Kiro 凭证访问上游。不要把客户端 API Key、错误日志或网关端口暴露给不受信任环境。
              </Alert>

              <Group grow mt="xs">
                <Button leftSection={<Activity size={16} />} variant="default" onClick={handleSave} loading={saving || loading}>保存配置</Button>
                {!status.running ? (
                  <Button color="green" leftSection={<Play size={16} />} onClick={handleStart} loading={saving || loading}>启动网关</Button>
                ) : (
                  <Button color="red" leftSection={<Square size={16} />} onClick={handleStop} loading={saving || loading}>停止网关</Button>
                )}
              </Group>

              <Button
                variant="light"
                leftSection={<RotateCcw size={16} />}
                onClick={handleRestart}
                loading={saving || loading}
              >
                重启网关
              </Button>
            </Stack>
          </Card>

          <Card withBorder radius="md" className={`${colors.card} ${colors.cardBorder}`}>
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <Shield size={16} />
                  <Text fw={600} className={colors.text}>运行状态</Text>
                </Group>
                <Group gap="xs">
                  <Badge color="blue" leftSection={<Radio size={12} />}>{config.accountMode === 'local' ? '本地登录态' : `账号池 ${config.strategy}`}</Badge>
                  <Badge color={config.localOnly ? 'teal' : 'yellow'}>{config.localOnly ? '仅本机' : '允许远程'}</Badge>
                  <Badge color={status.running ? 'green' : 'red'}>{status.running ? '运行中' : '已停止'}</Badge>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<RefreshCw size={14} />}
                    onClick={handleRefresh}
                    loading={loading}
                  >
                    刷新
                  </Button>
                </Group>
              </Group>

              <Text size="sm" className={colors.text}>监听地址 {status.host}:{status.port}</Text>
              <Text size="sm" className={colors.text}>请求计数 {status.requestCount}</Text>
              <Text size="sm" className={colors.text}>Region {config.region}</Text>
              <Text size="sm" className={colors.text}>日志级别 {config.logLevel}</Text>

              <Card withBorder radius="md">
                <Text size="sm" fw={600}>客户端配置</Text>
                <Text size="xs" mt={6} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {`ANTHROPIC_BASE_URL=${baseUrl}`}<br />
                  {`ANTHROPIC_API_KEY=${config.apiKey || 'sk-your-gateway-api-key'}`}<br />
                  {`OPENAI_BASE_URL=${baseUrl}`}<br />
                  {`OPENAI_API_KEY=${config.apiKey || 'sk-your-gateway-api-key'}`}
                </Text>
                <Text size="xs" mt={8} className={colors.textMuted}>
                  OpenAI 客户端主用 <Code>/v1/responses</Code>，兼容 <Code>/v1/chat/completions</Code>。
                </Text>
                <Group mt="sm" gap="xs">
                  <Button variant="light" leftSection={<Copy size={16} />} onClick={copyClientConfig}>复制配置</Button>
                  {copySuccess ? <Badge color="green" leftSection={<Check size={12} />}>{copySuccess}</Badge> : null}
                </Group>
              </Card>

              <Card withBorder radius="md">
                <Text size="sm" fw={600}>凭证口径</Text>
                <Stack gap={6} mt="xs">
                  <Text size="xs" className={colors.textMuted}>客户端 {'->'} 本地网关 使用 API Key</Text>
                  <Code block>Authorization: Bearer {config.apiKey || 'sk-your-gateway-api-key'}</Code>
                  <Text size="xs" className={colors.textMuted}>本地网关 {'->'} Kiro API 使用本地 access token</Text>
                  <Code block>Authorization: Bearer &lt;local kiro access token&gt;</Code>
                </Stack>
              </Card>

              <Card withBorder radius="md">
                <Text size="sm" fw={600}>日志目录</Text>
                <Text size="xs" mt={6} style={{ fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>
                  {logDir || '尚未获取'}
                </Text>
                <Group mt="sm" gap="xs">
                  <Button variant="light" leftSection={<FolderOpen size={16} />} onClick={handleOpenLogDir}>
                    打开日志目录
                  </Button>
                </Group>
              </Card>

              <Card withBorder radius="md">
                <Text size="sm" fw={600}>流式/上游错误明细</Text>
                <Stack gap={6} mt="xs">
                  {(streamErrors.length ? streamErrors : ['暂无流式错误']).map((item, idx) => (
                    <Code key={`${item}-${idx}`} block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {item}
                    </Code>
                  ))}
                </Stack>
              </Card>
            </Stack>
          </Card>
        </div>
      </Stack>
    </div>
  )
}

export default GatewayPage
