import AuthForm from '@/components/AuthForm'
import ConfigurationNotice from '@/components/ConfigurationNotice'
import { isPlaidConfigured } from '@/lib/config'

const SignUp = async () => {
  return (
    <section className="flex-center size-full max-sm:px-6">
      <AuthForm
        type="sign-up"
        notice={<ConfigurationNotice />}
        plaidEnabled={isPlaidConfigured()}
      />
    </section>
  )
}

export default SignUp
