import { Html, Text } from '@react-email/components';

export default function Welcome({ userName }: { userName: string }) {
  return (
    <Html>
      <Text>Hello {userName}</Text>
    </Html>
  );
}
