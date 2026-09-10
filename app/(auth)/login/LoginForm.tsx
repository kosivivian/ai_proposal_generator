"use client";

import { useActionState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn, signUp, type AuthActionState } from "./actions";

const initialState: AuthActionState = {};

export function LoginForm() {
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposal Generator</CardTitle>
        <CardDescription>Sign in to manage client proposals.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sign-in">
          <TabsList className="w-full">
            <TabsTrigger value="sign-in" className="flex-1">Sign in</TabsTrigger>
            <TabsTrigger value="sign-up" className="flex-1">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="sign-in">
            <form action={signInAction} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required autoComplete="current-password" />
              </div>
              {signInState.error && <p className="text-sm text-destructive">{signInState.error}</p>}
              <Button type="submit" className="w-full" disabled={signInPending}>
                {signInPending ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="sign-up">
            <form action={signUpAction} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" name="full_name" required autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup_email">Email</Label>
                <Input id="signup_email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup_password">Password</Label>
                <Input id="signup_password" name="password" type="password" required autoComplete="new-password" minLength={6} />
              </div>
              <p className="text-xs text-muted-foreground">
                New accounts start as a sales rep. An admin can grant approver/admin access afterward.
              </p>
              {signUpState.error && <p className="text-sm text-destructive">{signUpState.error}</p>}
              <Button type="submit" className="w-full" disabled={signUpPending}>
                {signUpPending ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
