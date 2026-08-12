import { Tailwind } from '@react-email/components';
import type { ReactNode } from 'react';

type TailwindWrapperProps = { children: ReactNode };

export function TailwindWrapper(props: TailwindWrapperProps) {
  return <Tailwind>{props.children}</Tailwind>;
}
