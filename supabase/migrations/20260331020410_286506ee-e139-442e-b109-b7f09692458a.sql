CREATE POLICY "Users can delete own notification logs" ON public.notification_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);