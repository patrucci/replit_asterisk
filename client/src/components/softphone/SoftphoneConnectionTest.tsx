import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Wifi, CheckCircle, AlertTriangle, XCircle, Settings, Globe, Server, HelpCircle, Shield } from 'lucide-react';
import { sipClient } from '@/lib/sipClient';
import { apiRequest } from '@/lib/queryClient';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface TestResult {
  success: boolean;
  message: string;
  details?: string;
}

interface DiagnosticResult {
  host: string;
  ip: string;
  dnsResolved: boolean;
  mainPort: number;
  mainPortOpen: boolean;
  errorType: string;
  openPorts: number[];
  recommendations: string[];
}

export function SoftphoneConnectionTest() {
  const [wsUri, setWsUri] = useState('wss://voip.lansolver.com:8089/ws');
  const [isTesting, setIsTesting] = useState(false);
  const [isDnsLookup, setIsDnsLookup] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [savedConfig, setSavedConfig] = useState<any>(null);
  const [dnsResults, setDnsResults] = useState<any>(null);
  const [hostName, setHostName] = useState('voip.lansolver.com');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  
  // Carregar configurações salvas do softphone
  useEffect(() => {
    try {
      const config = localStorage.getItem('softphone_config');
      if (config) {
        const parsedConfig = JSON.parse(config);
        setSavedConfig(parsedConfig);
        
        // Definir o URI WebSocket da configuração se estiver disponível
        if (parsedConfig.wsUri) {
          setWsUri(parsedConfig.wsUri);
          
          // Extrair o hostname do wsUri
          try {
            const url = new URL(parsedConfig.wsUri);
            setHostName(url.hostname);
          } catch (error) {
            console.error('Erro ao extrair hostname do URI:', error);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações salvas:', error);
    }
  }, []);
  
  // Função para realizar consulta DNS do hostname
  const performDnsLookup = async () => {
    if (!hostName) return;
    
    setIsDnsLookup(true);
    setDnsResults(null);
    
    try {
      console.log(`Realizando DNS lookup para ${hostName}...`);
      
      const response = await apiRequest('POST', '/api/asterisk/dns-lookup', { hostname: hostName });
      const data = await response.json();
      
      if (data.success) {
        console.log('Resultados DNS:', data.results);
        setDnsResults(data.results);
      } else {
        console.error('Erro na consulta DNS:', data.message);
        setDnsResults({ error: data.message });
      }
    } catch (error: any) {
      console.error('Falha ao realizar consulta DNS:', error);
      setDnsResults({ error: error.message || 'Erro desconhecido na consulta DNS' });
    } finally {
      setIsDnsLookup(false);
    }
  };
  
  // Função para testar a conexão WebSocket diretamente no navegador
  const testWebSocketConnection = async () => {
    if (!wsUri) {
      return;
    }
    
    // Garantir que estamos usando protocolo wss:// se a página estiver em HTTPS
    let testedUri = wsUri;
    if (window.location.protocol === 'https:' && testedUri.startsWith('ws://')) {
      testedUri = testedUri.replace('ws://', 'wss://');
      
      // Avisar sobre a alteração
      console.log(`Página HTTPS detectada. Modificando URI de ${wsUri} para ${testedUri}`);
      
      // Atualizar o campo para o usuário
      setWsUri(testedUri);
    }
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      console.log(`Testando conexão WebSocket com ${testedUri}...`);
      
      const ws = new WebSocket(testedUri);
      
      // Definir timeout para fechar após 10 segundos se não conectar
      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          setTestResult({
            success: false,
            message: `Timeout: Não foi possível estabelecer conexão após 10 segundos.`,
            details: 'O servidor não respondeu dentro do tempo esperado. Verifique se o endereço está correto e se o servidor está online.'
          });
          setIsTesting(false);
        }
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        console.log('WebSocket conectado com sucesso!');
        setTestResult({
          success: true,
          message: 'Conexão WebSocket estabelecida com sucesso!',
          details: `Conectado a ${wsUri}`
        });
        ws.close();
        setIsTesting(false);
      };
      
      ws.onerror = (event) => {
        clearTimeout(timeout);
        console.error('Erro na conexão WebSocket:', event);
        setTestResult({
          success: false,
          message: 'Erro ao tentar conectar via WebSocket',
          details: 'Verifique no console do navegador (F12) para detalhes específicos do erro.'
        });
        setIsTesting(false);
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeout);
        console.log('Conexão WebSocket fechada:', event.code, event.reason);
        
        // Se fechou não por timeout ou erro reportado pelo manipulador onerror
        if (!testResult) {
          const wasClean = event.wasClean;
          setTestResult({
            success: wasClean,
            message: wasClean 
              ? 'Conexão WebSocket fechada normalmente' 
              : `Conexão WebSocket fechada com erro (código ${event.code})`,
            details: wasClean
              ? 'A conexão foi estabelecida e fechada corretamente.'
              : `Código: ${event.code}. Razão: ${event.reason || 'Nenhuma razão específica fornecida'}`
          });
        }
        setIsTesting(false);
      };
    } catch (error: any) {
      console.error('Erro ao criar objeto WebSocket:', error);
      setTestResult({
        success: false,
        message: `Erro ao iniciar teste: ${error.message || 'Erro desconhecido'}`,
        details: 'Ocorreu um erro ao tentar criar o objeto WebSocket. Verifique se o URI é válido.'
      });
      setIsTesting(false);
    }
  };
  
  // Função para executar diagnóstico avançado
  const runAdvancedDiagnostic = async () => {
    if (!hostName) return;
    
    setIsDiagnosing(true);
    setDiagnosticResult(null);
    setTestResult({
      success: false,
      message: 'Executando diagnóstico avançado...',
      details: 'Analisando configurações de rede e conectividade com o servidor Asterisk.'
    });
    
    try {
      console.log(`Iniciando diagnóstico avançado para ${hostName}...`);
      
      // Extrair a porta do URI atual, se disponível
      let port = 5038; // Porta padrão AMI
      try {
        const url = new URL(wsUri);
        if (url.port) {
          const wsPort = parseInt(url.port);
          // Se estiver usando uma porta WebSocket (8088, 8089), usar essa porta
          if (wsPort === 8088 || wsPort === 8089) {
            port = wsPort;
          }
        }
      } catch (err) {
        // Continuar com a porta padrão
        console.error('Erro ao extrair porta do URI:', err);
      }
      
      const response = await apiRequest('POST', '/api/asterisk/diagnose', {
        host: hostName,
        port: port
      });
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Resultado do diagnóstico:', data);
      
      if (data.success && data.diagnosis) {
        setDiagnosticResult(data.diagnosis);
        
        // Se encontrou portas abertas para WebSocket, sugerir automaticamente
        if (data.diagnosis.openPorts?.includes(8088) || data.diagnosis.openPorts?.includes(8089)) {
          const openWsPort = data.diagnosis.openPorts.includes(8088) ? 8088 : 8089;
          // Construir um novo URI WebSocket usando a porta aberta
          const newUri = `wss://${hostName}:${openWsPort}/ws`;
          setWsUri(newUri);
          
          setTestResult({
            success: true,
            message: `Porta WebSocket ${openWsPort} encontrada aberta! URI atualizado.`,
            details: `Recomendamos usar ${newUri} para conectar o softphone.`
          });
        } else {
          setTestResult({
            success: false,
            message: "Problemas de conectividade detectados",
            details: "Verifique os resultados detalhados do diagnóstico abaixo."
          });
        }
      } else {
        throw new Error(data.message || 'Erro desconhecido no diagnóstico');
      }
    } catch (error: any) {
      console.error('Erro ao executar diagnóstico:', error);
      setTestResult({
        success: false,
        message: `Falha ao executar diagnóstico: ${error.message || 'Erro desconhecido'}`,
        details: 'Verifique a conexão com o servidor e tente novamente.'
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Função para tentar várias portas, mas apenas com protocolo seguro (wss://)
  const testBothProtocols = async () => {
    if (!wsUri) return;
    
    // Obter o URI base sem o protocolo
    let baseUri = wsUri;
    if (baseUri.startsWith('wss://')) {
      baseUri = baseUri.replace('wss://', '');
    } else if (baseUri.startsWith('ws://')) {
      baseUri = baseUri.replace('ws://', '');
    }
    
    // Extrair hostname e path
    let hostname = baseUri;
    let path = '/ws';
    let port = '';
    
    // Se tiver porta e/ou path, extrair
    if (baseUri.includes(':')) {
      const parts = baseUri.split(':');
      hostname = parts[0];
      
      // Se o segundo elemento contém uma /, precisa dividir novamente
      if (parts[1].includes('/')) {
        const portPathParts = parts[1].split('/');
        port = portPathParts[0];
        path = '/' + portPathParts.slice(1).join('/');
      } else {
        port = parts[1];
      }
    } else if (baseUri.includes('/')) {
      const parts = baseUri.split('/');
      hostname = parts[0];
      path = '/' + parts.slice(1).join('/');
    }
    
    // Se o path for vazio, usar /ws como padrão
    if (!path || path === '/') {
      path = '/ws';
    }
    
    // Lista de portas para testar (apenas com protocolo seguro wss://)
    const variations = [
      { protocol: 'wss', port: port || '8089' },
      { protocol: 'wss', port: '8088' },
      { protocol: 'wss', port: '443' }
    ];
    
    setIsTesting(true);
    setTestResult({
      success: false,
      message: 'Iniciando testes automáticos de conectividade...',
      details: `Testando ${variations.length} combinações diferentes de protocolo e porta.`
    });
    
    let anySuccess = false;
    let successMsg = '';
    
    for (const variation of variations) {
      const testUri = `${variation.protocol}://${hostname}:${variation.port}${path}`;
      
      setTestResult({
        success: false,
        message: `Testando ${testUri}...`,
        details: 'Aguarde enquanto tentamos conectar nesta configuração.'
      });
      
      try {
        const ws = new WebSocket(testUri);
        
        const result = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            ws.close();
            resolve(false);
          }, 5000);
          
          ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve(true);
          };
          
          ws.onerror = () => {
            clearTimeout(timeout);
            ws.close();
            resolve(false);
          };
        });
        
        if (result) {
          anySuccess = true;
          successMsg = testUri;
          setWsUri(testUri);
          break;
        }
      } catch (err) {
        console.error(`Erro ao testar ${testUri}:`, err);
      }
    }
    
    if (anySuccess) {
      setTestResult({
        success: true,
        message: 'Conexão bem-sucedida!',
        details: `O URI funcionou: ${successMsg}`
      });
    } else {
      setTestResult({
        success: false,
        message: 'Não foi possível conectar em nenhuma configuração.',
        details: 'Tentamos diversas combinações de protocolo e porta, mas nenhuma teve sucesso.'
      });
    }
    
    setIsTesting(false);
  };
  
  return (
    <Card className="w-full shadow-md">
      <CardHeader className="bg-secondary/50">
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Teste de Conexão SIP WebSocket
        </CardTitle>
        <CardDescription>
          Verifique a conectividade WebSocket com o servidor Asterisk para conectar o Softphone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        {savedConfig && (
          <Card className="bg-muted/40 border-dashed">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuração Atual do Softphone
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 text-xs font-mono">
              <div className="grid grid-cols-2 gap-1">
                <div className="text-muted-foreground">Domain:</div>
                <div>{savedConfig.domain}</div>
                
                <div className="text-muted-foreground">WebSocket URI:</div>
                <div>{savedConfig.wsUri}</div>
                
                <div className="text-muted-foreground">Ramal:</div>
                <div>{savedConfig.authorizationUser}</div>
                
                <div className="text-muted-foreground">Modo Simulação:</div>
                <div>{localStorage.getItem('softphone_mock_mode') === 'true' ? 'Ativado' : 'Desativado'}</div>
              </div>
            </CardContent>
          </Card>
        )}
      
        <div className="space-y-5">
          {/* Seção de DNS Lookup */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="hostname" className="text-sm font-medium">Hostname do Servidor</Label>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" />
                Diagnóstico DNS
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="hostname"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="voip.example.com"
                className="flex-1"
              />
              <Button 
                variant="outline" 
                onClick={performDnsLookup}
                disabled={isDnsLookup || !hostName}
                className="gap-1 whitespace-nowrap"
              >
                {isDnsLookup ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Server className="h-4 w-4" />
                )}
                <span className="hidden xs:inline">Verificar</span> DNS
              </Button>
            </div>
            
            {dnsResults && (
              <Card className="bg-muted/30 border-dashed">
                <CardHeader className="py-2">
                  <CardTitle className="text-sm">Resultados DNS para {dnsResults.hostname}</CardTitle>
                </CardHeader>
                <CardContent className="py-2 text-xs">
                  {dnsResults.error ? (
                    <Alert variant="destructive" className="p-2">
                      <AlertTriangle className="h-3 w-3" />
                      <AlertTitle className="text-xs ml-1">Erro na consulta DNS</AlertTitle>
                      <AlertDescription className="text-xs">{dnsResults.error}</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-2">
                      {dnsResults.defaultAddress && (
                        <div>
                          <div className="font-medium mb-1">Endereço Padrão:</div>
                          <code className="bg-muted p-1 rounded text-xs">
                            {dnsResults.defaultAddress.address} (IPv{dnsResults.defaultAddress.family})
                          </code>
                        </div>
                      )}
                      
                      {dnsResults.ipv4Addresses && dnsResults.ipv4Addresses.length > 0 && (
                        <div>
                          <div className="font-medium mb-1">Endereços IPv4:</div>
                          <div className="flex flex-wrap gap-1">
                            {dnsResults.ipv4Addresses.map((ip: string, i: number) => (
                              <div key={i} className="flex items-center">
                                <code className="bg-muted p-1 rounded text-xs">{ip}</code>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 px-2 py-0 ml-1 text-xs"
                                  onClick={() => {
                                    // Extrair a porta e o caminho do URI atual
                                    try {
                                      const currentUrl = new URL(wsUri);
                                      const port = currentUrl.port || (currentUrl.protocol === 'wss:' ? '443' : '80');
                                      const path = currentUrl.pathname || '/ws';
                                      const protocol = currentUrl.protocol === 'wss:' ? 'wss:' : 'ws:';
                                      
                                      // Criar novo URI usando o IP
                                      const newUri = `${protocol}//${ip}:${port}${path}`;
                                      setWsUri(newUri);
                                    } catch (err) {
                                      console.error('Erro ao construir URI com IP:', err);
                                    }
                                  }}
                                >
                                  Usar IP
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {dnsResults.ipv6Addresses && dnsResults.ipv6Addresses.length > 0 && (
                        <div>
                          <div className="font-medium mb-1">Endereços IPv6:</div>
                          <div className="flex flex-wrap gap-1">
                            {dnsResults.ipv6Addresses.map((ip: string, i: number) => (
                              <code key={i} className="bg-muted p-1 rounded text-xs overflow-x-auto">{ip}</code>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(!dnsResults.ipv4Addresses || dnsResults.ipv4Addresses.length === 0) && 
                       (!dnsResults.ipv6Addresses || dnsResults.ipv6Addresses.length === 0) && (
                        <Alert variant="destructive" className="p-2">
                          <AlertTriangle className="h-3 w-3" />
                          <AlertTitle className="text-xs ml-1">Nenhum endereço IP encontrado</AlertTitle>
                          <AlertDescription className="text-xs">
                            O hostname não foi resolvido para nenhum endereço IP.
                            Verifique se o nome está correto ou tente usar um endereço IP diretamente.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          
          <Separator />
          
          {/* Seção de Teste WebSocket */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="ws-uri">URI do WebSocket SIP</Label>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Wifi className="h-3 w-3" />
                Teste de Conexão
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="ws-uri"
                value={wsUri}
                onChange={(e) => {
                  let newValue = e.target.value;
                  
                  // Se a página estiver em HTTPS e o usuário digitar ws://, converter para wss://
                  if (window.location.protocol === 'https:' && newValue.startsWith('ws://')) {
                    newValue = newValue.replace('ws://', 'wss://');
                    
                    // Atualizamos o valor mas também mostramos o alerta
                    setTestResult({
                      success: false,
                      message: "Protocolo inseguro detectado e corrigido",
                      details: "Em páginas HTTPS, apenas conexões seguras (wss://) são permitidas. O URI foi convertido automaticamente."
                    });
                  }
                  
                  setWsUri(newValue);
                }}
                placeholder="wss://voip.example.com:8089/ws"
                className="flex-1"
              />
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  onClick={testWebSocketConnection}
                  disabled={isTesting || isDiagnosing || !wsUri}
                  className="flex-1 sm:flex-none"
                >
                  {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Testar
                </Button>
                <Button 
                  variant="outline" 
                  onClick={testBothProtocols}
                  disabled={isTesting || isDiagnosing || !wsUri}
                  title="Testa diversas combinações de protocolos e portas automaticamente"
                  className="gap-1 flex-1 sm:flex-none whitespace-nowrap"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="m18 16 4-4-4-4"></path>
                    <path d="m6 8-4 4 4 4"></path>
                    <path d="m14.5 4-5 16"></path>
                  </svg>
                  <span className="hidden xs:inline">Teste</span> Completo
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={runAdvancedDiagnostic}
                  disabled={isTesting || isDiagnosing || !hostName}
                  title="Executa uma análise completa de conectividade com o servidor"
                  className="gap-1 flex-1 sm:flex-none whitespace-nowrap"
                >
                  {isDiagnosing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <HelpCircle className="h-4 w-4 mr-1" />
                  )}
                  <span className="hidden xs:inline">Diagnóstico</span> Avançado
                </Button>
              </div>
            </div>
          </div>
          
          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"} className="mt-4">
              <div className="flex items-center gap-2">
                {testResult.success 
                  ? <CheckCircle className="h-4 w-4" /> 
                  : <XCircle className="h-4 w-4" />
                }
                <AlertTitle>
                  {testResult.success ? "Conexão bem-sucedida" : "Falha na conexão"}
                </AlertTitle>
              </div>
              <AlertDescription className="mt-2">
                <p>{testResult.message}</p>
                {testResult.details && (
                  <p className="mt-2 text-xs opacity-80">{testResult.details}</p>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          {/* Resultados do Diagnóstico Avançado */}
          {diagnosticResult && (
            <div className="mt-4 border rounded-md">
              <div className="bg-muted py-2 px-4 rounded-t-md border-b flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Diagnóstico avançado para {diagnosticResult.host}
                </h3>
                <div className="text-xs bg-primary/10 rounded-full px-2 py-0.5">
                  IP: {diagnosticResult.ip}
                </div>
              </div>
              
              <div className="p-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="status" className="border-b">
                    <AccordionTrigger className="text-sm py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${diagnosticResult.mainPortOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        Status da Conexão Principal
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-xs">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Porta Principal:</span>
                          <span className="font-mono">{diagnosticResult.mainPort}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>DNS Resolvido:</span>
                          <span className={diagnosticResult.dnsResolved ? 'text-green-500' : 'text-red-500'}>
                            {diagnosticResult.dnsResolved ? 'Sim' : 'Não'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Porta Principal Aberta:</span>
                          <span className={diagnosticResult.mainPortOpen ? 'text-green-500' : 'text-red-500'}>
                            {diagnosticResult.mainPortOpen ? 'Sim' : 'Não'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tipo de Erro:</span>
                          <span className="font-mono">{diagnosticResult.errorType || 'Nenhum'}</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="ports" className="border-b">
                    <AccordionTrigger className="text-sm py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${diagnosticResult.openPorts?.length > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        Portas Abertas
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-xs">
                      {diagnosticResult.openPorts?.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {diagnosticResult.openPorts.map((port) => (
                              <span 
                                key={port} 
                                className={`bg-muted px-2 py-1 rounded font-mono ${
                                  (port === 8088 || port === 8089) ? 'bg-green-100 border border-green-200' : ''
                                }`}
                              >
                                {port}{(port === 8088 || port === 8089) && ' ✓'}
                              </span>
                            ))}
                          </div>
                          {(diagnosticResult.openPorts.includes(8088) || diagnosticResult.openPorts.includes(8089)) && (
                            <p className="text-green-600 mt-2">
                              Uma porta WebSocket SIP foi encontrada aberta! Isso é bom para a configuração do softphone.
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-red-500">Nenhuma porta alternativa está aberta.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="recommendations">
                    <AccordionTrigger className="text-sm py-2">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        Recomendações
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-xs">
                      {diagnosticResult.recommendations?.length > 0 ? (
                        <ul className="list-disc list-inside space-y-2">
                          {diagnosticResult.recommendations.map((rec, i) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">Nenhuma recomendação disponível.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Problemas de conectividade?
            </h3>
            
            <Button
              variant="destructive"
              size="sm"
              className="w-full sm:w-auto h-8 sm:h-7 text-xs gap-1"
              onClick={() => {
                localStorage.setItem('softphone_mock_mode', 'true');
                
                // Mostrar alerta
                setTestResult({
                  success: true,
                  message: 'Modo de simulação ativado com sucesso!',
                  details: 'O softphone agora funcionará em modo de simulação. Recarregue a página para que as alterações tenham efeito.'
                });
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                <path d="M15 12h.01"></path>
                <path d="M19 12h.01"></path>
                <path d="M11 12h.01"></path>
                <path d="M7 12h.01"></path>
                <path d="M15 16h.01"></path>
                <path d="M19 16h.01"></path>
                <path d="M11 16h.01"></path>
                <path d="M7 16h.01"></path>
                <path d="M5 8h14"></path>
              </svg>
              Usar Modo de Simulação
            </Button>
          </div>
          
          <div className="bg-muted p-4 rounded-md">
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li>O WebSocket URI deve usar o formato: <code>wss://dominio.com:porta/ws</code></li>
              <li>Portas comuns para WebSocket SIP: 8088 ou 8089</li>
              <li className="text-amber-600 font-medium">⚠️ Em páginas HTTPS, apenas conexões seguras <code>wss://</code> são permitidas</li>
              <li>Verifique se o módulo WebSocket está habilitado no Asterisk</li>
              <li>Certifique-se que o firewall não está bloqueando a porta WebSocket</li>
              <li>Para conexões <code>wss://</code>, o certificado SSL deve ser válido</li>
              <li><strong>Se o servidor estiver inacessível</strong>, use o Modo de Simulação para testar a interface</li>
            </ul>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-3 text-xs text-muted-foreground">
        Esta ferramenta testa apenas a conexão WebSocket. Um teste bem-sucedido não garante que o 
        registro SIP funcionará, mas confirma que o servidor Asterisk está acessível.
      </CardFooter>
    </Card>
  );
}