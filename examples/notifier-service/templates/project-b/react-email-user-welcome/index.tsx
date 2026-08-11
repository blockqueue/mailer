import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { CompanyFooter } from './_components/CompanyFooter';
import { SocialLinks } from './_components/SocialLinks';
import { TailwindWrapper } from './_components/TailwindWrapper';
import * as config from './_utility/config';

interface WelcomeEmailProps {
  userName: string;
  appName: string;
  ctaUrl?: string;
}

export function Email(props: WelcomeEmailProps) {
  const {
    userName,
    appName,
    ctaUrl = config.blockQueueDomain,
  } = props;

  return (
    <Html>
      <Head />
      <Preview>
        Welcome to {appName}, {userName} — your account is ready.
      </Preview>
      <TailwindWrapper>
        <Body className="bg-zinc-100 font-sans text-zinc-900">
          <Container className="mx-auto my-8 max-w-[560px] overflow-hidden rounded-lg bg-white">
            <Section className="bg-zinc-900 px-8 py-6">
              <Text className="m-0 text-lg font-semibold tracking-tight text-white">
                {appName}
              </Text>
            </Section>

            <Section className="px-8 py-8">
              <Heading className="m-0 mb-3 text-2xl font-semibold leading-snug text-zinc-900">
                Welcome, {userName}
              </Heading>
              <Text className="m-0 mb-4 text-base leading-relaxed text-zinc-600">
                Thanks for joining {appName}. Your account is ready — jump in to
                finish setup and start building.
              </Text>
              <Button
                href={ctaUrl}
                className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-semibold text-white no-underline"
              >
                Get started
              </Button>
            </Section>

            <Section className="px-8 pb-8">
              <Hr className="mb-6 border-zinc-200" />
              <SocialLinks
                instagram={config.socials.instagram.link}
                linkedin={config.socials.linkedin.link}
                facebook={config.socials.facebook.link}
                twitter={config.socials.twitter.link}
              />
              <CompanyFooter />
            </Section>
          </Container>
        </Body>
      </TailwindWrapper>
    </Html>
  );
}

export default Email;
