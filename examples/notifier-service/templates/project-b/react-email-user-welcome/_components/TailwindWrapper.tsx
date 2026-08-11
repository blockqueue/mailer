import { Tailwind } from '@react-email/components';
import React from 'react';

type TailwindWrapperProps = { children: React.ReactNode };
export function TailwindWrapper(props: TailwindWrapperProps) {
  return <Tailwind>{props.children}</Tailwind>;
}
