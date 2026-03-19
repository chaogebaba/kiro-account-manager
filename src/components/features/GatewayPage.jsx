import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Copy, Play, Square, Activity, AlertCircle, Shield, Server, RefreshCw, Radio } from 'lucide-react'
import { Button, Card, Group, Stack, Text, TextInput, NumberInput, Select, Badge, Code } from '@mantine/core'
import { useApp } from '../../hooks/useApp'

const DEFAULT_CONFIG = {
  enabled: false,
  host: '127.0.0.1',
  port: 8765,
  apiKey: '',
  region: 'us-east-1',
}

function GatewayPage() {
  const { colors } = useApp()
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [status, setStatus] = useState({ running: false, host: '127.0.0.1', port: 8765, requestCount: 0, lastError: null })
  const [errors, setErrors] = useState([])
  const [streamErrors, setStreamErrors] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

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
      const [cfg, st] = await Promise.all([
        invoke('get_gateway_config'),
        invoke('get_gateway_status'),
      ])

      setConfig({
        enabled: cfg?.enabled ?? false,
        host: cfg?.host || '127.0.0.1',
        port: cfg?.port || 8765,
        apiKey: cfg?.accessToken || '',
        region: cfg?.region || 'us-east-1',
      })

      setStatus({
        running: st?.running ?? false,
        host: st?.host || cfg?.host || '127.0.0.1',
        port: st?.port || cfg?.port || 8765,
        requestCount: st?.requestCount || 0,
        lastError: st?.lastError || null,
      })

      if (st?.lastError) {
        pushError(st.lastError)
        pushStreamError(st.lastError)
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
      const text = `ANTHROPIC_BASE_URL=${baseUrl}\nANTHROPIC_API_KEY=${config.apiKey || 'sk-your-gateway-api-key'}\nOPENAI_BASE_URL=${baseUrl}\nOPENAI_API_KEY=${config.apiKey || 'sk-your-gateway-api-key'}`
      await navigator.clipboard.writeText(text)
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
                label="客户端 API Key（可选）"
                description="用于客户端 Authorization: Bearer <apiKey>。这不是 Kiro access token，Kiro access token 会从本地账号自动读取。"
                placeholder="sk-..."
                value={config.apiKey}
                onChange={(e) => setField('apiKey', e.currentTarget.value)}
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

              <Group grow mt="xs">
                <Button leftSection={<Activity size={16} />} variant="default" onClick={handleSave} loading={saving || loading}>保存配置</Button>
                {!status.running ? (
                  <Button color="green" leftSection={<Play size={16} />} onClick={handleStart} loading={saving || loading}>启动网关</Button>
                ) : (
                  <Button color="red" leftSection={<Square size={16} />} onClick={handleStop} loading={saving || loading}>停止网关</Button>
                )}
              </Group>
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
                  <Badge color="blue" leftSection={<Radio size={12} />}>客户端 API Key 模式</Badge>
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

              <Card withBorder radius="md">
                <Text size="sm" fw={600}>客户端配置</Text>
                <Text size="xs" mt={6} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {`ANTHROPIC_BASE_URL=${baseUrl}`}<br />
                  {`ANTHROPIC_API_KEY=${config.apiKey || 'sk-your-gateway-api-key'}`}<br />
                  {`OPENAI_BASE_URL=${baseUrl}`}<br />
                  {`OPENAI_API_KEY=${config.apiKey || 'sk-your-gateway-api-key'}`}
                </Text>
                <Button mt="sm" variant="light" leftSection={<Copy size={16} />} onClick={copyClientConfig}>复制配置</Button>
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
