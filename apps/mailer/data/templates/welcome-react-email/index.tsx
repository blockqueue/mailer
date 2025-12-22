import { Body, Container, Head, Html, Text } from '@react-email/components';

interface WelcomeEmailProps {
  userName: string;
  appName: string;
}
export default function WelcomeEmail(props: WelcomeEmailProps) {
  const { userName, appName } = props;
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>Hello {userName}!</Text>
          <Text>Welcome to {appName}!</Text>
        </Container>
      </Body>
    </Html>
  );
}
