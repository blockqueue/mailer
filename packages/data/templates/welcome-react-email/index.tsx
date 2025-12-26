import {
  Body,
  Container,
  Head,
  Html,
  Section,
  Text,
} from '@react-email/components';
import React from 'react';
import { SocialLinks } from '../_components/SocialLinks';
import { TailwindWrapper } from '../_components/TailwindWrapper';

interface WelcomeEmailProps {
  userName: string;
  appName: string;
}
export function Email(props: WelcomeEmailProps) {
  const { userName, appName } = props;
  return (
    <Html>
      <Head />

      <TailwindWrapper>
        <Body>
          <Container>
            <Text>Hello {userName}!</Text>
            <Text>Welcome to {appName}!</Text>

            <Section className="mt-12 border-t border-gray-200 pt-8">
              <SocialLinks
                instagram="https://www.instagram.com/blockqueue/"
                linkedin="https://www.linkedin.com/company/blockqueue/"
                facebook="https://www.facebook.com/blockqueue/"
                twitter="https://x.com/blockqueue"
              />
            </Section>
          </Container>
        </Body>
      </TailwindWrapper>
    </Html>
  );
}

export default Email;
