import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import React from 'react';
import { CompanyFooter } from '../_components/CompanyFooter';
import { SocialLinks } from '../_components/SocialLinks';
import { TailwindWrapper } from '../_components/TailwindWrapper';
import * as config from '../_utility/config';

export type EmailProps = Readonly<{ email: string; url: string }>;
export function Email(props: EmailProps) {
  return (
    <Html>
      <TailwindWrapper>
        <Head />
        <Preview>Log in to with this magic link</Preview>

        <Body className="bg-gray-100">
          <Container className="mx-auto max-w-2xl rounded-lg border border-gray-300 bg-white px-6 py-10 shadow-lg">
            <div className="mb-6 flex justify-center">
              <Img
                src={config.logoUrl}
                width="80"
                height="80"
                alt={`${config.appName} Logo`}
                className="h-16 w-auto"
              />
            </div>
            <Heading className="mb-4 text-center text-3xl font-bold text-gray-800">
              Log in to {config.appName}
            </Heading>

            <Text className="mb-6 text-base text-gray-600">
              Hello,
              <br />
              <br />
              Here is the login link you requested for your account:
              <span className="font-semibold text-gray-800">
                {' '}
                {props.email}
              </span>
              .
              <br />
              This link is only valid for the next{' '}
              <span className="font-semibold">ten (10) minutes</span>.
            </Text>

            <Section className="mb-8 text-center">
              <Button
                href={props.url}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-blue-700"
              >
                Log In Now
              </Button>
            </Section>

            <Section className="mb-8 text-center">
              <Text className="mb-2 text-sm text-gray-600">
                Or copy and paste this URL into your browser:
              </Text>
              <Link
                href={props.url}
                className="break-all text-xs text-blue-600 hover:text-blue-800"
              >
                {props.url}
              </Link>
            </Section>

            <Text className="mb-6 text-sm text-gray-500">
              If you did not request this login link, you can safely ignore this
              email.
            </Text>

            <SocialLinks
              instagram={config.socials.instagram.link}
              linkedin={config.socials.linkedin.link}
              facebook={config.socials.facebook.link}
              twitter={config.socials.twitter.link}
            />
            <CompanyFooter />
          </Container>
        </Body>
      </TailwindWrapper>
    </Html>
  );
}

Email.PreviewProps = {
  email: 'user@example.com',
  url: 'https://app.propertygovernors.com/api/auth/callback/email?callbackUrl=https%3A%2F%2Fapp.propertygovernors.com%2F&token=78ed6287218dc79ce8c84f0ea1aaa8e74d2d574b6e26340bc51d0a200f7e8be1&email=user%40example.com',
} as EmailProps;

export default Email;
