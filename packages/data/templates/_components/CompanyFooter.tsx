import React from 'react';
import { Link, Text } from '@react-email/components';
import * as config from '../_utility/config';

export function CompanyFooter() {
  return (
    <div className="mt-8 border-t border-gray-300">
      <Text className="my-1 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} {config.companyName}. All rights reserved.
      </Text>
      <Text className="my-1 text-center text-xs text-gray-500">
        {config.companyAddress}
      </Text>
      <Text className="my-1 text-center text-xs">
        <Link
          href={config.blockQueueDomain}
          className="text-blue-600 hover:underline"
        >
          {config.blockQueueDomain}
        </Link>
      </Text>
    </div>
  );
}
