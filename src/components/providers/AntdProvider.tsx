'use client';

import React from 'react';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, theme } from 'antd';
import viVN from 'antd/locale/vi_VN';

export function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider
        locale={viVN}
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#6366f1', // Indigo 500
            colorInfo: '#6366f1',
            colorSuccess: '#10b981', // Emerald 500
            colorWarning: '#f59e0b', // Amber 500
            colorError: '#f43f5e', // Rose 500
            colorBgBase: '#0b0f19',
            colorBgContainer: '#0f172a',
            colorBgElevated: '#1e293b',
            colorBorder: '#334155',
            colorBorderSecondary: '#1e293b',
            borderRadius: 12,
            fontFamily: 'inherit',
          },
          components: {
            Button: {
              borderRadius: 10,
              controlHeight: 38,
              fontWeight: 500,
            },
            Input: {
              borderRadius: 10,
              controlHeight: 40,
              colorBgContainer: '#0b1120',
            },
            Select: {
              borderRadius: 10,
              controlHeight: 40,
              colorBgContainer: '#0b1120',
            },
            Card: {
              borderRadiusLG: 16,
              colorBgContainer: 'rgba(15, 23, 42, 0.7)',
            },
            Menu: {
              itemBorderRadius: 10,
              colorBgContainer: 'transparent',
              colorItemBgHover: 'rgba(99, 102, 241, 0.1)',
              colorItemBgSelected: 'rgba(99, 102, 241, 0.15)',
              colorItemTextSelected: '#818cf8',
            },
            Table: {
              colorBgContainer: 'transparent',
              headerBg: '#0f172a',
              headerColor: '#94a3b8',
              rowHoverBg: 'rgba(30, 41, 59, 0.5)',
            },
            Tabs: {
              itemSelectedColor: '#818cf8',
              inkBarColor: '#6366f1',
            },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </AntdRegistry>
  );
}
