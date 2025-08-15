import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Building2, Mail, Lock, User, Phone } from "lucide-react";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
  company: z.string().min(2, "Nome da empresa é obrigatório"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  plan: z.enum(["basic", "pro", "enterprise"], { message: "Selecione um plano" }),
  acceptTerms: z.boolean().refine((val) => val === true, "Você deve aceitar os termos de uso"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

const PLAN_DETAILS = {
  basic: { 
    name: "Básico", 
    price: "R$ 29/mês", 
    messages: "1.000 mensagens",
    description: "Ideal para pequenas lojas"
  },
  pro: { 
    name: "Pro", 
    price: "R$ 89/mês", 
    messages: "10.000 mensagens",
    description: "Para lojas em crescimento"
  },
  enterprise: { 
    name: "Enterprise", 
    price: "R$ 199/mês", 
    messages: "Mensagens ilimitadas",
    description: "Para grandes operações"
  },
};

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      company: "",
      phone: "",
      plan: undefined,
      acceptTerms: false,
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const { confirmPassword, acceptTerms, ...registerData } = data;
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(registerData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro no registro");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Conta criada com sucesso!",
        description: "Você será redirecionado para configurar sua instância WhatsApp.",
      });
      // Redirect to onboarding or dashboard
      setLocation("/welcome");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no registro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">WhatsFlow</h1>
          <p className="text-gray-600">Automatize suas mensagens WhatsApp para WooCommerce</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Criar Conta</CardTitle>
            <CardDescription>
              Comece sua jornada de automação WhatsApp hoje
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      placeholder="Seu nome completo"
                      className="pl-10"
                      {...form.register("name")}
                      data-testid="input-name"
                    />
                  </div>
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-10"
                      {...form.register("email")}
                      data-testid="input-email"
                    />
                  </div>
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Company Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Nome da Empresa</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="company"
                      placeholder="Sua empresa"
                      className="pl-10"
                      {...form.register("company")}
                      data-testid="input-company"
                    />
                  </div>
                  {form.formState.errors.company && (
                    <p className="text-sm text-red-600">{form.formState.errors.company.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      placeholder="(47) 99999-9999"
                      className="pl-10"
                      {...form.register("phone")}
                      data-testid="input-phone"
                    />
                  </div>
                  {form.formState.errors.phone && (
                    <p className="text-sm text-red-600">{form.formState.errors.phone.message}</p>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      className="pl-10"
                      {...form.register("password")}
                      data-testid="input-password"
                    />
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Digite a senha novamente"
                      className="pl-10"
                      {...form.register("confirmPassword")}
                      data-testid="input-confirm-password"
                    />
                  </div>
                  {form.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-600">{form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              {/* Plan Selection */}
              <div className="space-y-2">
                <Label>Escolha seu Plano</Label>
                <Select onValueChange={(value) => form.setValue("plan", value as any)}>
                  <SelectTrigger data-testid="select-plan">
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLAN_DETAILS).map(([key, plan]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex flex-col">
                          <div className="font-medium">{plan.name} - {plan.price}</div>
                          <div className="text-sm text-gray-500">{plan.messages} • {plan.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.plan && (
                  <p className="text-sm text-red-600">{form.formState.errors.plan.message}</p>
                )}
              </div>

              {/* Plan Details */}
              {form.watch("plan") && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">
                    Plano Selecionado: {PLAN_DETAILS[form.watch("plan")!].name}
                  </h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• {PLAN_DETAILS[form.watch("plan")!].messages} por mês</li>
                    <li>• 1 instância WhatsApp</li>
                    <li>• Templates ilimitados</li>
                    <li>• Webhook WooCommerce</li>
                    <li>• Suporte técnico</li>
                  </ul>
                </div>
              )}

              {/* Terms */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="acceptTerms"
                  checked={form.watch("acceptTerms")}
                  onCheckedChange={(checked) => form.setValue("acceptTerms", checked as boolean)}
                  data-testid="checkbox-terms"
                />
                <Label htmlFor="acceptTerms" className="text-sm">
                  Eu aceito os{" "}
                  <Link href="/terms" className="text-blue-600 hover:underline">
                    Termos de Uso
                  </Link>{" "}
                  e{" "}
                  <Link href="/privacy" className="text-blue-600 hover:underline">
                    Política de Privacidade
                  </Link>
                </Label>
              </div>
              {form.formState.errors.acceptTerms && (
                <p className="text-sm text-red-600">{form.formState.errors.acceptTerms.message}</p>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                disabled={registerMutation.isPending}
                data-testid="button-register"
              >
                {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Conta e Começar
              </Button>
            </form>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Já tem uma conta?{" "}
                <Link href="/login" className="text-blue-600 hover:underline font-medium">
                  Faça login
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}