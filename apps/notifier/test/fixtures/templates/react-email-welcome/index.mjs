import React from 'react';
import { Html, Text } from '@react-email/components';

export default function Welcome({ userName }) {
  return React.createElement(
    Html,
    null,
    React.createElement(Text, null, `Hello ${userName}`),
  );
}
