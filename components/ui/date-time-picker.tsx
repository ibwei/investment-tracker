'use client'

import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { ConfigProvider, DatePicker } from 'antd'
import { toInputDateTimeValue, toUtcISOString } from '@/lib/time'

dayjs.extend(customParseFormat)

type DateTimePickerProps = {
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const DISPLAY_FORMAT = 'YYYY/MM/DD HH:mm:ss'
const STORAGE_FORMAT = 'YYYY-MM-DD HH:mm:ss'

function toDayjs(value?: string) {
  if (!value) {
    return null
  }

  const parsed = dayjs(toInputDateTimeValue(value), [STORAGE_FORMAT, DISPLAY_FORMAT], true)
  return parsed.isValid() ? parsed : dayjs(value)
}

export function DateTimePicker({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  className,
}: DateTimePickerProps) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorBgContainer: '#09090b',
          colorBgElevated: '#09090b',
          colorText: '#f4f4f5',
          colorTextPlaceholder: '#71717a',
          colorBorder: '#27272a',
          colorPrimary: '#34d399',
          colorPrimaryHover: '#4ade80',
          borderRadius: 8,
          controlHeight: 40,
        },
      }}
    >
      <DatePicker
        showTime={{ format: 'HH:mm:ss' }}
        format={DISPLAY_FORMAT}
        value={toDayjs(value)}
        placeholder={placeholder}
        disabled={disabled}
        onBlur={onBlur}
        onChange={(nextValue) =>
          onChange?.(nextValue ? toUtcISOString(nextValue.format(STORAGE_FORMAT)) : '')
        }
        getPopupContainer={() => document.body}
        popupClassName="earn-date-time-popup"
        popupStyle={{ zIndex: 1600 }}
        placement="bottomLeft"
        className={className}
        style={{ width: '100%' }}
      />
    </ConfigProvider>
  )
}
