import { Img, Link } from '@react-email/components';

type SocialLinksProps = {
  instagram?: string;
  linkedin?: string;
  facebook?: string;
  twitter?: string;
};
export function SocialLinks(props: SocialLinksProps) {
  const socialLinks = [
    {
      name: 'Instagram',
      href: props.instagram,
      icon: 'https://raw.githubusercontent.com/blockqueue/mailer/packages/data/logos/instagram.svg',
    },
    {
      name: 'LinkedIn',
      href: props.linkedin,
      icon: 'https://raw.githubusercontent.com/blockqueue/mailer/packages/data/logos/linkedin.svg',
    },
    {
      name: 'Facebook',
      href: props.facebook,
      icon: 'https://raw.githubusercontent.com/blockqueue/mailer/packages/data/logos/facebook.svg',
    },
    {
      name: 'Twitter',
      href: props.twitter,
      icon: 'https://raw.githubusercontent.com/blockqueue/mailer/packages/data/logos/twitter.svg',
    },
  ];
  return (
    <div className="mt-2 flex items-center justify-center">
      {socialLinks.map((link) => (
        <Link href={link.href} className="mx-1" key={link.name}>
          <Img src={link.icon} width="22" height="22" alt={link.name} />
        </Link>
      ))}
    </div>
  );
}
