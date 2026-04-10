'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Investment, InvestmentType } from '@/lib/types'
import { useInvestmentStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toDateTimeValue } from '@/lib/calculations'

function createInvestmentSchema(t: (key: string) => string) {
  return z.object({
    project: z.string().min(1, t('validation.projectRequired')),
    name: z.string().min(1, t('validation.nameRequired')),
    url: z.string().url(t('validation.urlInvalid')).or(z.literal('')),
    type: z.enum(['interest', 'lp', 'lending', 'cedefi']),
    amount: z.coerce.number().min(0.01, t('validation.amountPositive')),
    currency: z.string().min(1, t('validation.currencyRequired')),
    description: z.string(),
    startDate: z.string().min(1, t('validation.startDateRequired')),
    endDate: z.string().min(1, t('validation.endDateRequired')),
    remark: z.string(),
    expectedApr: z
      .coerce
      .number()
      .min(0, t('validation.aprNonNegative'))
      .max(1000, t('validation.aprTooHigh')),
    actualApr: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) {
          return undefined
        }
        return value
      },
      z.coerce.number().min(0).max(1000).optional(),
    ),
    expectedIncome: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) {
          return undefined
        }
        return value
      },
      z.coerce.number().min(0, t('validation.incomeNonNegative')).optional(),
    ),
  })
}

type InvestmentFormValues = {
  project: string
  name: string
  url: string
  type: InvestmentType
  amount: number | string
  currency: string
  description: string
  startDate: string
  endDate: string
  remark: string
  expectedApr: number | string
  actualApr?: number | string
  expectedIncome?: number | string
}
type FormData = z.output<ReturnType<typeof createInvestmentSchema>>

interface InvestmentFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  investment?: Investment | null
}

export function InvestmentForm({ open, onOpenChange, investment }: InvestmentFormProps) {
  const addInvestment = useInvestmentStore((state) => state.addInvestment)
  const updateInvestment = useInvestmentStore((state) => state.updateInvestment)
  const { t, getTypeLabel } = useI18n()
  const investmentSchema = createInvestmentSchema(t)

  const form = useForm<InvestmentFormValues>({
    resolver: zodResolver(investmentSchema) as any,
    defaultValues: {
      project: '',
      name: '',
      url: '',
      type: 'interest',
      amount: 0,
      currency: 'USDC',
      description: '',
      startDate: toDateTimeValue(new Date()),
      endDate: '',
      remark: '',
      expectedApr: 0,
      actualApr: undefined,
      expectedIncome: undefined,
    },
  })
  const isSubmitting = form.formState.isSubmitting

  useEffect(() => {
    if (investment) {
      form.reset({
        project: investment.project,
        name: investment.name,
        url: investment.url,
        type: investment.type,
        amount: investment.amount,
        currency: investment.currency,
        description: investment.description,
        startDate: investment.startDate,
        endDate: investment.endDate,
        remark: investment.remark,
        expectedApr: investment.expectedApr,
        actualApr: investment.actualApr,
        expectedIncome: investment.totalIncome,
      })
    } else {
      form.reset({
        project: '',
        name: '',
        url: '',
        type: 'interest',
        amount: 0,
        currency: 'USDC',
        description: '',
        startDate: toDateTimeValue(new Date()),
        endDate: '',
        remark: '',
        expectedApr: 0,
        actualApr: undefined,
        expectedIncome: undefined,
      })
    }
  }, [investment, form])

  const onSubmit = async (values: any) => {
    const data = investmentSchema.parse(values) as FormData

    if (investment) {
      await updateInvestment(investment.id, data)
    } else {
      await addInvestment(data as Required<FormData>)
    }
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) {
          onOpenChange(nextOpen)
        }
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]"
        showCloseButton={!isSubmitting}
      >
        <DialogHeader>
          <DialogTitle>
            {investment ? t('form.editTitle') : t('form.addTitle')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="project"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.project')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('form.projectPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('form.namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.urlLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('form.urlPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.type')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.selectType')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="interest">{getTypeLabel('interest')}</SelectItem>
                        <SelectItem value="lp">{getTypeLabel('lp')}</SelectItem>
                        <SelectItem value="lending">{getTypeLabel('lending')}</SelectItem>
                        <SelectItem value="cedefi">{getTypeLabel('cedefi')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.amount')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.currency')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.selectCurrency')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="USDT">USDT</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="USDe">USDe</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                        <SelectItem value="BTC">BTC</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.startDate')}</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.endDate')}</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="expectedApr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.expectedApr')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expectedIncome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.expectedIncome')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={t('form.expectedIncomePlaceholder')}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="actualApr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.actualApr')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1" 
                        placeholder={t('form.actualAprPlaceholder')}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.description')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('form.descriptionPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remark"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.remark')}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t('form.remarkPlaceholder')}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-border bg-background hover:bg-muted hover:text-foreground"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {investment ? t('common.saveChanges') : t('common.addInvestment')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
