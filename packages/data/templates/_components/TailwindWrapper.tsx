import { Tailwind, pixelBasedPreset } from '@react-email/components';

const tailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        brand: '#007291',
      },
    },
  },
};

type TailwindWrapperProps = { children: React.ReactNode };
export function TailwindWrapper(props: TailwindWrapperProps) {
  return (
    <Tailwind config={{ theme: tailwindConfig.theme, important: true }}>
      {props.children}
    </Tailwind>
  );
}
