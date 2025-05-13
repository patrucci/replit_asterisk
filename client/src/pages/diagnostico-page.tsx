import { SoftphoneConnectionTest } from "@/components/softphone/SoftphoneConnectionTest";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

export default function DiagnosticoPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        <Card className="border-2 border-primary/20">
          <CardHeader className="bg-muted py-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Diagnóstico de Conectividade</CardTitle>
                <CardDescription>
                  Ferramentas para diagnosticar problemas de conexão com o servidor Asterisk
                </CardDescription>
              </div>
              <Link href="/auth">
                <Button variant="outline">Voltar para o Login</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <p className="text-sm max-w-2xl">
                Esta página permite diagnosticar problemas de conectividade com o servidor Asterisk.
                Use as ferramentas abaixo para verificar a conectividade com o servidor, diagnosticar
                problemas de DNS, e testar a conexão WebSocket necessária para o funcionamento do softphone.
              </p>
              
              <SoftphoneConnectionTest />
              
              <div className="flex justify-end mt-8">
                <Link href="/auth">
                  <Button>Voltar para Login</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}