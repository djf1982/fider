import React, { useState } from "react"
import { SignInModal, RSSModal, NotificationIndicator, UserMenu, Icon, Button, ModerationIndicator } from "@fider/components"
import { useFider } from "@fider/hooks"
import { HStack } from "./layout"
import { Trans } from "@lingui/react/macro"
import { i18n } from "@lingui/core"
import IconRss from "@fider/assets/images/heroicons-rss.svg"
import "./Header.scss"

interface HeaderProps {
  hasInert?: boolean
}

// SCOUTWORKS wordmark — must stay identical to the marketing site's
// Navbar.tsx (see WEBSITE-STYLE-GUIDE.md §3.5).
const ScoutworksWordmark = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -22.32 164 29" width="164" height="29" role="img" aria-label="Scoutworks" className="c-header__wordmark">
    <path
      fill="currentColor"
      d="M8.14-16.08L8.14-16.08Q10.42-16.08 12.23-15.52Q14.04-14.95 15.43-13.82L15.43-13.82L13.18-10.22Q12.05-11.02 10.81-11.50Q9.58-11.98 8.14-11.98L8.14-11.98Q7.51-11.98 7.14-11.88Q6.77-11.78 6.61-11.62Q6.46-11.45 6.46-11.23L6.46-11.23Q6.46-10.94 6.90-10.80Q7.34-10.66 8.02-10.49L8.02-10.49L10.20-9.98Q12.62-9.43 13.86-8.35Q15.10-7.27 15.10-5.35L15.10-5.35Q15.10-3.43 14.16-2.20Q13.22-0.96 11.63-0.36Q10.03 0.24 8.02 0.24L8.02 0.24Q6.50 0.24 4.99-0.04Q3.48-0.31 2.18-0.85Q0.89-1.39-0.05-2.16L-0.05-2.16L2.16-5.83Q2.86-5.28 3.84-4.84Q4.82-4.39 5.88-4.13Q6.94-3.86 7.85-3.86L7.85-3.86Q8.42-3.86 8.76-3.96Q9.10-4.06 9.23-4.21Q9.36-4.37 9.36-4.58L9.36-4.58Q9.36-4.92 9.08-5.09Q8.81-5.26 8.09-5.42L8.09-5.42L5.69-5.95Q4.42-6.24 3.26-6.72Q2.11-7.20 1.39-8.12Q0.67-9.05 0.67-10.63L0.67-10.63Q0.67-12.26 1.55-13.49Q2.42-14.71 4.09-15.40Q5.76-16.08 8.14-16.08Z M25.49-6.12L30.43-4.85Q30-3 28.96-1.87Q27.91-0.74 26.42-0.25Q24.94 0.24 23.11 0.24L23.11 0.24Q20.62 0.24 18.80-0.72Q16.99-1.68 16.02-3.50Q15.05-5.33 15.05-7.92L15.05-7.92Q15.05-10.51 16.02-12.34Q16.99-14.16 18.80-15.12Q20.62-16.08 23.11-16.08L23.11-16.08Q24.86-16.08 26.38-15.59Q27.89-15.10 28.93-14.04Q29.98-12.98 30.31-11.28L30.31-11.28L25.51-9.41Q25.32-10.97 24.73-11.42Q24.14-11.88 23.26-11.88L23.26-11.88Q22.44-11.88 21.88-11.46Q21.31-11.04 21.04-10.16Q20.76-9.29 20.76-7.92L20.76-7.92Q20.76-6.58 21.01-5.69Q21.26-4.80 21.84-4.38Q22.42-3.96 23.38-3.96L23.38-3.96Q24.24-3.96 24.79-4.48Q25.34-4.99 25.49-6.12L25.49-6.12Z M38.16-16.08L38.16-16.08Q40.68-16.08 42.48-15.12Q44.28-14.16 45.24-12.34Q46.20-10.51 46.20-7.92L46.20-7.92Q46.20-5.33 45.24-3.50Q44.28-1.68 42.48-0.72Q40.68 0.24 38.16 0.24L38.16 0.24Q35.66 0.24 33.85-0.72Q32.04-1.68 31.07-3.50Q30.10-5.33 30.10-7.92L30.10-7.92Q30.10-10.51 31.07-12.34Q32.04-14.16 33.85-15.12Q35.66-16.08 38.16-16.08ZM38.16-11.88L38.16-11.88Q37.34-11.88 36.83-11.46Q36.31-11.04 36.06-10.18Q35.81-9.31 35.81-7.92L35.81-7.92Q35.81-6.55 36.06-5.68Q36.31-4.80 36.83-4.38Q37.34-3.96 38.16-3.96L38.16-3.96Q38.98-3.96 39.49-4.38Q40.01-4.80 40.25-5.68Q40.49-6.55 40.49-7.92L40.49-7.92Q40.49-9.31 40.25-10.18Q40.01-11.04 39.49-11.46Q38.98-11.88 38.16-11.88Z M56.30-15.84L61.90-15.84L61.90-6.82Q61.90-3.26 59.99-1.51Q58.08 0.24 54.24 0.24L54.24 0.24Q50.40 0.24 48.49-1.51Q46.58-3.26 46.58-6.82L46.58-6.82L46.58-15.84L52.20-15.84L52.20-6.38Q52.20-5.18 52.73-4.57Q53.26-3.96 54.24-3.96L54.24-3.96Q55.25-3.96 55.78-4.57Q56.30-5.18 56.30-6.38L56.30-6.38L56.30-15.84Z M62.06-15.84L77.57-15.84L77.57-11.74L72.62-11.74L72.62 0L67.03 0L67.03-11.74L62.06-11.74L62.06-15.84Z M87.29 0L81.14 0L76.66-15.84L82.68-15.84L84.53-4.39L86.76-15.84L91.56-15.84L93.91-4.46L95.71-15.84L101.52-15.84L97.01 0L91.08 0L89.83-5.95L89.21-10.01L89.14-10.01L88.51-5.95L87.29 0Z M108.91-16.08L108.91-16.08Q111.43-16.08 113.23-15.12Q115.03-14.16 115.99-12.34Q116.95-10.51 116.95-7.92L116.95-7.92Q116.95-5.33 115.99-3.50Q115.03-1.68 113.23-0.72Q111.43 0.24 108.91 0.24L108.91 0.24Q106.42 0.24 104.60-0.72Q102.79-1.68 101.82-3.50Q100.85-5.33 100.85-7.92L100.85-7.92Q100.85-10.51 101.82-12.34Q102.79-14.16 104.60-15.12Q106.42-16.08 108.91-16.08ZM108.91-11.88L108.91-11.88Q108.10-11.88 107.58-11.46Q107.06-11.04 106.81-10.18Q106.56-9.31 106.56-7.92L106.56-7.92Q106.56-6.55 106.81-5.68Q107.06-4.80 107.58-4.38Q108.10-3.96 108.91-3.96L108.91-3.96Q109.73-3.96 110.24-4.38Q110.76-4.80 111-5.68Q111.24-6.55 111.24-7.92L111.24-7.92Q111.24-9.31 111-10.18Q110.76-11.04 110.24-11.46Q109.73-11.88 108.91-11.88Z M117.65-15.84L126.24-15.84Q129.34-15.84 130.99-14.46Q132.65-13.08 132.65-10.80L132.65-10.80Q132.65-8.18 131.03-6.86Q129.41-5.54 126.31-5.54L126.31-5.54L125.76-5.26L123.12-5.26L123.12 0L117.65 0L117.65-15.84ZM123.12-8.93L125.28-8.93Q126.17-8.93 126.61-9.25Q127.06-9.58 127.06-10.39L127.06-10.39Q127.06-11.18 126.61-11.52Q126.17-11.86 125.28-11.86L125.28-11.86L123.12-11.86L123.12-8.93ZM123.77-6.94L128.59-7.75L133.54 0L127.46 0L123.77-6.94Z M143.09-15.84L149.04-15.84L141.26-5.74L141.02-6.96L137.54-2.21L136.25-6.07L143.09-15.84ZM133.37-15.84L138.96-15.84L138.96 0L133.37 0L133.37-15.84ZM139.27-7.92L143.38-11.02L149.47 0L143.21 0L139.27-7.92Z M156.31-16.08L156.31-16.08Q158.59-16.08 160.40-15.52Q162.22-14.95 163.61-13.82L163.61-13.82L161.35-10.22Q160.22-11.02 158.99-11.50Q157.75-11.98 156.31-11.98L156.31-11.98Q155.69-11.98 155.32-11.88Q154.94-11.78 154.79-11.62Q154.63-11.45 154.63-11.23L154.63-11.23Q154.63-10.94 155.08-10.80Q155.52-10.66 156.19-10.49L156.19-10.49L158.38-9.98Q160.80-9.43 162.04-8.35Q163.27-7.27 163.27-5.35L163.27-5.35Q163.27-3.43 162.34-2.20Q161.40-0.96 159.80-0.36Q158.21 0.24 156.19 0.24L156.19 0.24Q154.68 0.24 153.17-0.04Q151.66-0.31 150.36-0.85Q149.06-1.39 148.13-2.16L148.13-2.16L150.34-5.83Q151.03-5.28 152.02-4.84Q153.00-4.39 154.06-4.13Q155.11-3.86 156.02-3.86L156.02-3.86Q156.60-3.86 156.94-3.96Q157.27-4.06 157.40-4.21Q157.54-4.37 157.54-4.58L157.54-4.58Q157.54-4.92 157.26-5.09Q156.98-5.26 156.26-5.42L156.26-5.42L153.86-5.95Q152.59-6.24 151.44-6.72Q150.29-7.20 149.57-8.12Q148.85-9.05 148.85-10.63L148.85-10.63Q148.85-12.26 149.72-13.49Q150.60-14.71 152.27-15.40Q153.94-16.08 156.31-16.08Z"
    />
  </svg>
)

export const Header = (props: HeaderProps) => {
  const fider = useFider()
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const [isRSSModalOpen, setIsRSSModalOpen] = useState(false)

  const handleSignInClick = () => {
    setIsSignInModalOpen(true)
  }

  const showRSSModal = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsRSSModalOpen(true)
  }

  const atomFeedTitle = i18n._({ id: "action.postsfeed", message: "Posts Feed" })
  const hideSignInModal = () => setIsSignInModalOpen(false)
  const hideRSSModal = () => setIsRSSModalOpen(false)

  return (
    <div id="c-header" className="bg-white" {...(props.hasInert && { inert: "true" })}>
      <SignInModal isOpen={isSignInModalOpen} onClose={hideSignInModal} />
      <RSSModal isOpen={isRSSModalOpen} onClose={hideRSSModal} url={`${fider.settings.baseURL}/feed/global.atom`} />
      <HStack className="c-menu p-4 w-full">
        <div className="container c-header__container">
          <div className="flex flex-wrap flex-items-center gap-2">
            <div className="flex flex-x flex-items-center justify-between w-full">
              <a href="https://scoutworks.app" className="flex flex-x flex-items-center h-8 c-header__logo-link" aria-label="Scoutworks">
                <ScoutworksWordmark />
              </a>
              {fider.session.isAuthenticated && (
                <HStack spacing={2}>
                  {fider.session.tenant.isFeedEnabled && (
                    <button title={atomFeedTitle} className="c-themeswitcher" onClick={showRSSModal}>
                      <Icon sprite={IconRss} className="h-6 text-gray-500" />
                    </button>
                  )}
                  <NotificationIndicator />
                  <UserMenu />
                </HStack>
              )}
              {!fider.session.isAuthenticated && (
                <HStack spacing={2}>
                  {fider.session.tenant.isFeedEnabled && (
                    <button title={atomFeedTitle} className="c-themeswitcher" onClick={showRSSModal}>
                      <Icon sprite={IconRss} className="h-6 text-gray-500" />
                    </button>
                  )}
                  <Button variant="primary" size="default" onClick={handleSignInClick}>
                    <HStack spacing={1} className="flex-items-center">
                      <span>
                        <Trans id="action.signin">Sign in</Trans>
                      </span>
                    </HStack>
                  </Button>
                </HStack>
              )}
            </div>
            {fider.session.isAuthenticated && (
              <div className="c-header__moderation">
                <ModerationIndicator />
              </div>
            )}
          </div>
        </div>
      </HStack>
    </div>
  )
}
