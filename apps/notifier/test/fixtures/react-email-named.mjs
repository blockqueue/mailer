import React from 'react';
import { Html, Text } from '@react-email/components';

export function Email({ userName }) {
  return React.createElement(
    Html,
    null,
    React.createElement(Text, null, `Hello ${userName}`),
  );
}
