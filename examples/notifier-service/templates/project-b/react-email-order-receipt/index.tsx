import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import { TailwindWrapper } from './_components/TailwindWrapper';

interface LineItem {
  name: string;
  quantity: number;
  price: string;
}

interface OrderReceiptEmailProps {
  orderId: string;
  customerName: string;
  appName: string;
  lineItems: LineItem[];
  total: string;
  shippingAddress?: string;
  isGift?: boolean;
  trackingUrl?: string;
}

export function Email(props: OrderReceiptEmailProps) {
  const {
    orderId,
    customerName,
    appName,
    lineItems,
    total,
    shippingAddress,
    isGift = false,
    trackingUrl,
  } = props;

  return (
    <TailwindWrapper>
      <Html>
        <Head />
        <Preview>
          Order {orderId} confirmed for {customerName}.
        </Preview>
        <Body className="bg-zinc-100 font-sans text-zinc-900">
          <Container className="mx-auto my-8 max-w-[560px] overflow-hidden rounded-lg bg-white">
            <Section className="bg-zinc-900 px-8 py-6">
              <Text className="m-0 text-lg font-semibold tracking-tight text-white">
                {appName}
              </Text>
            </Section>

            <Section className="px-8 py-8">
              <Heading className="m-0 mb-2 text-2xl font-semibold leading-snug text-zinc-900">
                Order confirmed
              </Heading>
              <Text className="m-0 mb-5 text-base leading-relaxed text-zinc-600">
                Hi {customerName}, thanks for your order{' '}
                <span className="font-semibold text-zinc-900">{orderId}</span>.
              </Text>

              {isGift ? (
                <Text className="m-0 mb-5 rounded-md bg-zinc-100 px-3.5 py-3 text-sm leading-relaxed text-zinc-600">
                  This order is marked as a gift — we will not include pricing
                  on the packing slip.
                </Text>
              ) : null}

              <Row className="mb-2 border-b border-zinc-200 pb-2">
                <Column>
                  <Text className="m-0 text-xs uppercase tracking-wide text-zinc-500">
                    Item
                  </Text>
                </Column>
                <Column align="right" className="w-[48px]">
                  <Text className="m-0 text-xs uppercase tracking-wide text-zinc-500">
                    Qty
                  </Text>
                </Column>
                <Column align="right" className="w-[72px]">
                  <Text className="m-0 text-xs uppercase tracking-wide text-zinc-500">
                    Price
                  </Text>
                </Column>
              </Row>

              {lineItems.map((item) => (
                <Row
                  key={`${item.name}-${String(item.quantity)}-${item.price}`}
                  className="border-b border-zinc-100 py-1"
                >
                  <Column>
                    <Text className="m-0 text-[15px] text-zinc-900">
                      {item.name}
                    </Text>
                  </Column>
                  <Column align="right" className="w-[48px]">
                    <Text className="m-0 text-[15px] text-zinc-900">
                      {item.quantity}
                    </Text>
                  </Column>
                  <Column align="right" className="w-[72px]">
                    <Text className="m-0 text-[15px] text-zinc-900">
                      {item.price}
                    </Text>
                  </Column>
                </Row>
              ))}

              <Row className="mt-4">
                <Column>
                  <Text className="m-0 text-base font-semibold text-zinc-900">
                    Total
                  </Text>
                </Column>
                <Column align="right">
                  <Text className="m-0 text-base font-semibold text-zinc-900">
                    {total}
                  </Text>
                </Column>
              </Row>

              {shippingAddress ? (
                <>
                  <Text className="mb-1 mt-6 text-xs text-zinc-500">
                    Ships to
                  </Text>
                  <Text className="m-0 mb-4 text-[15px] leading-relaxed text-zinc-600">
                    {shippingAddress}
                  </Text>
                </>
              ) : null}

              {trackingUrl ? (
                <Button
                  href={trackingUrl}
                  className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-semibold text-white no-underline"
                >
                  Track shipment
                </Button>
              ) : null}
            </Section>

            <Section className="px-8 pb-8">
              <Hr className="mb-4 border-zinc-200" />
              <Text className="m-0 text-xs text-zinc-400">
                You received this email because an order was placed on {appName}
                .
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </TailwindWrapper>
  );
}

export default Email;
