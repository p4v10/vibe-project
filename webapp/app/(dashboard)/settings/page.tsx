import { createClient } from '@/lib/supabase/server'
import { Shield, Lock, Info } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400 mb-8">Account information and security overview.</p>

        {/* Account Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold text-white mb-4">Account</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">Email</span>
              <span className="text-sm text-white">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">Account ID</span>
              <span className="text-xs text-gray-500 font-mono">{user?.id}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-400">Member since</span>
              <span className="text-sm text-white">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Security Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Security</h2>
          </div>
          <div className="space-y-3 text-sm text-gray-400">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
              <span>API keys are encrypted with AES-256-GCM before being stored in the database.</span>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
              <span>Only the last 4 characters of each key are retained for display.</span>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
              <span>Prompt sanitization runs server-side — raw prompts never leave your server unsanitized.</span>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
              <span>No chat content is stored or logged by default.</span>
            </div>
          </div>
        </div>

        {/* Data Notice */}
        <div className="flex items-start gap-3 p-4 bg-blue-900/20 border border-blue-800/40 rounded-xl">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-300">
            To manage or delete your API keys, visit the{' '}
            <a href="/setup" className="underline hover:text-blue-200">
              Model Setup
            </a>{' '}
            page.
          </p>
        </div>
      </div>
    </div>
  )
}
