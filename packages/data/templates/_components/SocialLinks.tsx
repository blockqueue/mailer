import { Img, Link } from '@react-email/components';
import * as config from '../_utility/config';

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
      icon: `${config.blockQueueDomain}/images/mailer/instagram.png`,
    },
    {
      name: 'LinkedIn',
      href: props.linkedin,
      icon: `${config.blockQueueDomain}/images/mailer/linkedin.png`,
    },
    {
      name: 'Facebook',
      href: props.facebook,
      icon: `${config.blockQueueDomain}/images/mailer/facebook.png`,
    },
    {
      name: 'Twitter',
      href: props.twitter,
      icon: `${config.blockQueueDomain}/images/mailer/twitter.png`,
    },
  ];
  return (
    <div className="flex items-center justify-center">
      {socialLinks.map((link) => (
        <Link href={link.href} className="mx-1" key={link.name}>
          <Img src={link.icon} width="20" height="20" alt={link.name} />
        </Link>
      ))}
    </div>
  );
}
