import AuthForm from '@/components/AuthForm'
import ConfigurationNotice from '@/components/ConfigurationNotice'

const SignIn = () => {
  return (
    <section className="flex-center size-full max-sm:px-6">
      <AuthForm type="sign-in" notice={<ConfigurationNotice />} />
    </section>
  )
}

export default SignIn
