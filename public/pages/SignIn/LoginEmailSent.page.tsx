import React from "react"
import IconInbox from "@fider/assets/images/heroicons-inbox.svg"

import { LegalFooter, TenantLogo, IconBadge } from "@fider/components"
import { Trans } from "@lingui/react/macro"

import "./LoginEmailSent.page.scss"

const LoginEmailSentPage = ({ email }: { email: string }) => {
  return (
    <>
      <div id="p-email-sent" className="page container w-max-6xl bg-gray-100">
        <div className="flex flex-y justify-center flex-items-center full-height py-4">
          <div className="text-center mb-8">
            <a href="/">
              <TenantLogo size={50} />
            </a>
          </div>

          <div className="box shadow-sm text-center w-full">
            <IconBadge sprite={IconInbox} className="mt-4 mb-8" />

            <p className="text-xl text-center mb-4 text-gray-800">
              <Trans id="signin.message.emailsent">
                We have just sent a confirmation link to <b>{email}</b>. Click the link and you’ll be signed in.
              </Trans>
            </p>

            <LegalFooter />
          </div>
        </div>
      </div>
    </>
  )
}
export default LoginEmailSentPage
