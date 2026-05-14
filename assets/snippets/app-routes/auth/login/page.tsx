"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type AuthState } from "../actions";
import { t } from "@/i18n/he";

const initial: AuthState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">{t.auth.welcomeBack}</CardTitle>
        <CardDescription>{t.auth.loginSubtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t.auth.email}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              className="text-start"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t.auth.password}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              dir="ltr"
              className="text-start"
              autoComplete="current-password"
              required
            />
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t.common.loading : t.auth.loginAction}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t.auth.noAccount}{" "}
            <Link
              href="/signup"
              className="font-medium text-primary hover:underline"
            >
              {t.auth.signup}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
