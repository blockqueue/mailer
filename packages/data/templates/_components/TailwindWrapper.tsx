import React from 'react';
import { Tailwind } from '@react-email/components';

type TailwindWrapperProps = { children: React.ReactNode };
export function TailwindWrapper(props: TailwindWrapperProps) {
  return <Tailwind>{props.children}</Tailwind>;
}
