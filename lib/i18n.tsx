'use client'

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

type Locale = 'en' | 'zh'

type TranslationParams = Record<string, string | number>

const LOCALE_STORAGE_KEY = 'earn-compass-locale'
const DISPLAY_CURRENCY_STORAGE_KEY = 'earn-compass-display-currency'
const EXCHANGE_RATE_STORAGE_KEY = 'earn-compass-usd-display-rate'

export const DISPLAY_CURRENCIES = [
  'USD',
  'CNY',
  'EUR',
  'GBP',
  'JPY',
  'HKD',
  'SGD',
  'AUD',
  'CAD',
  'CHF',
  'KRW',
  'AED',
] as const

type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]

const translations = {
  en: {
    common: {
      brand: 'Earn Compass',
      language: 'Language',
      languageDescription: 'Switch the interface language.',
      languages: {
        en: 'English',
        zh: 'Chinese',
      },
      cancel: 'Cancel',
      save: 'Save',
      saving: 'Saving...',
      saveChanges: 'Save Changes',
      edit: 'Edit',
      delete: 'Delete',
      addInvestment: 'Add Investment',
      exportData: 'Export Data',
      clearAllData: 'Clear All Data',
      search: 'Search',
      project: 'Project',
      name: 'Name',
      type: 'Type',
      amount: 'Amount',
      status: 'Status',
      actions: 'Actions',
      expected: 'Expected',
      actual: 'Actual',
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly',
      total: 'Total',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      termsOfService: 'Terms of Service',
      privacyPolicy: 'Privacy Policy',
      providers: {
        google: 'Google',
        github: 'GitHub',
      },
      displayName: 'Display Name',
      timezone: 'Timezone',
      defaultCurrency: 'Default Currency',
      currency: 'Currency',
      profile: 'Profile',
      logout: 'Log out',
      notifications: 'Notifications',
      displayPreferences: 'Display Preferences',
      dataManagement: 'Data Management',
      orContinueWith: 'Or continue with',
    },
    nav: {
      dashboard: 'Dashboard',
      analytics: 'Analytics',
      settings: 'Settings',
      login: 'Log in',
      getStarted: 'Get Started',
      myAccount: 'My Account',
    },
    dashboard: {
      title: 'Investment Dashboard',
      subtitle: 'Track and manage your CeFi & DeFi investments',
      portfolio: 'Investment Portfolio',
    },
    stats: {
      totalInvestment: 'Total Investment',
      dailyIncome: 'Daily Income',
      monthlyIncome: 'Monthly Income',
      averageApr: 'Average APR',
      activePositions: '{count} active positions',
      weeklyIncome: '{value} weekly',
      yearlyIncome: '{value} yearly',
      acrossAllPositions: 'Across all positions',
    },
    filters: {
      searchInvestments: 'Search investments...',
      projectPlaceholder: 'Project',
      typePlaceholder: 'Type',
      statusPlaceholder: 'Status',
      allProjects: 'All Projects',
      allTypes: 'All Types',
      allStatus: 'All Status',
    },
    types: {
      interest: 'Interest',
      lp: 'LP',
      lending: 'Lending',
      cedefi: 'CeDeFi',
    },
    statuses: {
      active: 'Active',
      ended: 'Ended',
      early_ended: 'Early Ended',
      deleted: 'Deleted',
    },
    table: {
      activeInvestments: 'Active Investments',
      activeInvestmentsDescription: 'Ongoing positions with live income metrics and start date.',
      historyInvestments: 'Closed Investments',
      historyInvestmentsDescription: 'Ended positions with timeline and settlement details.',
      noInvestmentsFound: 'No investments found',
      noActiveInvestments: 'No active investments found',
      noHistoryInvestments: 'No closed investments found',
      deleteInvestment: 'Delete Investment',
      deleteDescription:
        'Are you sure you want to delete {project} - {name}?',
      deleteAmount: 'Amount: {amount}',
      deletePermanent: 'This action cannot be undone.',
      typeDeleteToConfirm: 'Type {keyword} to confirm',
      endInvestmentEarly: 'End Investment Early',
      endDescription:
        'Are you sure you want to end {project} - {name} early?',
      originalEndDate: 'Original end date: {date}',
      endHint:
        'The investment will be marked as ended and income calculations will stop.',
      endInvestment: 'End Investment',
      openLink: 'Open project link',
      finishDate: 'Finish Date',
      finalIncome: 'Final Total Income',
      finalIncomeHint: 'Edit APR or income and we will sync the other value.',
      actualAprLabel: 'Actual APR (%)',
      actualAprHint: 'Based on principal and holding days.',
      holdingDays: 'Holding Days: {days}',
      startDate: 'Start',
      endDate: 'End',
      timeline: 'Timeline',
      settlement: 'Settlement',
      finalSettlement: 'Final income',
      earlyExitRemark: 'Early exit note',
      noRemark: 'No note',
      projectedDailyIncome: 'Final daily income: {amount}',
      saveFinishChanges: 'Save Finish Details',
    },
    form: {
      addTitle: 'Add New Investment',
      editTitle: 'Edit Investment',
      projectPlaceholder: 'e.g., Pendle',
      namePlaceholder: 'e.g., USDF PT',
      urlLabel: 'URL (optional)',
      urlPlaceholder: 'https://...',
      selectType: 'Select type',
      selectCurrency: 'Select currency',
      startDate: 'Start Date',
      endDate: 'End Date',
      expectedApr: 'Expected APR (%)',
      expectedIncome: 'Expected Income (optional)',
      expectedIncomePlaceholder: 'Known final income amount',
      actualApr: 'Actual APR (%) - Optional',
      actualAprPlaceholder: 'Leave empty to use expected',
      description: 'Description',
      descriptionPlaceholder: 'e.g., PT Position',
      remark: 'Remark',
      remarkPlaceholder: 'Additional notes...',
    },
    validation: {
      projectRequired: 'Project name is required',
      nameRequired: 'Investment name is required',
      urlInvalid: 'Please enter a valid URL',
      amountPositive: 'Amount must be greater than 0',
      currencyRequired: 'Currency is required',
      startDateRequired: 'Start date is required',
      endDateRequired: 'End date is required',
      aprNonNegative: 'APR must be non-negative',
      incomeNonNegative: 'Income must be non-negative',
      aprTooHigh: 'APR seems too high',
      validEmail: 'Please enter a valid email',
      passwordMin: 'Password must be at least 8 characters',
      nameMin: 'Name must be at least 2 characters',
      acceptTerms: 'You must accept the terms',
      passwordsMismatch: "Passwords don't match",
    },
    analytics: {
      title: 'Analytics',
      subtitle: 'Analyze your investment performance and earnings',
      earningsOverview: 'Earnings Overview',
      monthlyEarnings: 'Monthly Earnings',
      cumulative: 'Cumulative',
      monthly: 'Monthly',
      projectedIncomeTrend: 'Projected Income Trend',
      projectedIncomeTrendDescription: 'Derived from the current investment timeline. Compare it with the stored snapshot history above.',
      snapshotTrend: 'Snapshot Trend',
      snapshotTrendDescription: 'Stores the projected daily, weekly, and monthly income captured at each scheduled run, separate from the derived charts below.',
      captureSnapshot: 'Capture Today',
      latestSnapshotDaily: 'Latest Daily Snapshot',
      latestSnapshotWeekly: 'Latest Weekly Snapshot',
      latestSnapshotMonthly: 'Latest Monthly Snapshot',
      latestSnapshotCumulative: 'Latest Cumulative Snapshot',
      snapshotDaily: 'Captured Daily',
      snapshotWeekly: 'Captured Weekly',
      snapshotMonthly: 'Captured Monthly',
      snapshotCumulative: 'Captured Cumulative',
      loadingSnapshots: 'Loading snapshot history...',
      loadingSnapshotsDescription: 'Fetching your stored daily snapshots.',
      noSnapshotData: 'No snapshot data yet',
      noSnapshotDataDescription: 'Run one manual capture now or let the scheduled job write the first historical point.',
      portfolioIncomeVolatility: 'Portfolio Income Volatility',
      portfolioIncomeVolatilityDescription: 'Track daily income swings and cumulative income changes across the portfolio.',
      dailyProjected: 'Projected Daily',
      weeklyProjected: 'Projected Weekly',
      monthlyProjected: 'Projected Monthly',
      dailyPortfolioIncome: 'Daily Portfolio Income',
      cumulativeProjectedIncome: 'Cumulative Income',
      activeCapital: 'Active Capital',
      aprComparison: 'APR Comparison',
      expectedApr: 'Expected APR',
      actualApr: 'Actual APR',
      expected: 'Expected',
      actual: 'Actual',
      portfolioAllocation: 'Portfolio Allocation',
      totalInvested: 'Total Invested',
      amount: 'Amount',
      dailyIncome: 'Daily Income',
      weeklyIncome: 'Weekly Income',
      monthlyIncome: 'Monthly Income',
      yearlyIncome: 'Yearly Income',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Manage your account and application preferences',
      profileDescription: 'Manage your account information',
      notificationsDescription: 'Configure how you receive updates',
      earningsUpdates: 'Earnings Updates',
      earningsUpdatesDescription: 'Get notified when earnings are calculated',
      maturityAlerts: 'Maturity Alerts',
      maturityAlertsDescription: 'Notify when investments are about to mature',
      weeklySummary: 'Weekly Summary',
      weeklySummaryDescription: 'Receive weekly performance summary',
      monthlyReport: 'Monthly Report',
      monthlyReportDescription: 'Get detailed monthly investment report',
      displayDescription: 'Customize your viewing experience',
      dataManagementDescription: 'Export or manage your investment data',
      namePlaceholder: 'Your name',
      emailPlaceholder: 'your@email.com',
      clearDataTitle: 'Are you absolutely sure?',
      clearDataDescription:
        'This action cannot be undone. This will permanently delete all your investment data from this device.',
      deleteAllData: 'Delete All Data',
      saveSuccess: 'Settings saved successfully',
      exportSuccess: 'Data exported successfully',
      clearSuccess: 'All data has been cleared',
      saveFailed: 'Failed to save settings.',
    },
    auth: {
      loginTitle: 'Welcome back',
      loginSubtitle: 'Sign in to your account to continue',
      registerTitle: 'Create an account',
      registerSubtitle: 'Start tracking your investments today',
      fullName: 'Full Name',
      fullNamePlaceholder: 'John Doe',
      emailPlaceholder: 'you@example.com',
      passwordPlaceholder: 'Create a password',
      currentPasswordPlaceholder: 'Enter your password',
      confirmPasswordPlaceholder: 'Confirm your password',
      forgotPassword: 'Forgot password?',
      signIn: 'Sign in',
      signingIn: 'Signing in...',
      createAccount: 'Create account',
      creatingAccount: 'Creating account...',
      noAccount: "Don't have an account?",
      alreadyHaveAccount: 'Already have an account?',
      signUp: 'Sign up',
      signInLink: 'Sign in',
      loginSuccess: 'Logged in successfully',
      registerSuccess: 'Account created successfully',
      loginFailed: 'Login failed.',
      registerFailed: 'Registration failed.',
      agreeToTermsPrefix: 'I agree to the',
      footerAgreement: 'By continuing, you agree to our',
      continueWithProvider: 'Continue with {provider}',
    },
    passwordRules: {
      minLength: 'At least 8 characters',
      hasNumber: 'Contains a number',
      hasUppercase: 'Contains uppercase',
      hasLowercase: 'Contains lowercase',
    },
    errors: {
      emailRequired: 'Email is required.',
      validEmail: 'Please enter a valid email.',
      passwordMin: 'Password must be at least 8 characters.',
      emailExists: 'An account with this email already exists.',
      invalidCredentials: 'Invalid email or password.',
      unauthorized: 'Unauthorized.',
      userNotFound: 'User not found.',
      emailInUse: 'Email is already in use.',
      requestFailed: 'Request failed.',
      loginFailed: 'Login failed.',
      registrationFailed: 'Registration failed.',
      unsupportedOAuthProvider: 'Unsupported OAuth provider.',
      oauthProviderNotConfigured: 'OAuth provider is not configured.',
      oauthStateInvalid: 'OAuth state is invalid or expired.',
      oauthDenied: 'OAuth authorization was denied.',
      oauthFailed: 'OAuth sign in failed.',
      googleEmailUnavailable: 'Google account email is unavailable or not verified.',
      githubEmailUnavailable: 'GitHub account email is unavailable or not verified.',
      oauthAccountIdRequired: 'OAuth account identifier is required.',
    },
  },
  zh: {
    common: {
      brand: 'Earn Compass',
      language: '语言',
      languageDescription: '切换界面语言。',
      languages: {
        en: 'English',
        zh: '中文',
      },
      cancel: '取消',
      save: '保存',
      saving: '保存中...',
      saveChanges: '保存修改',
      edit: '编辑',
      delete: '删除',
      addInvestment: '新增投资',
      exportData: '导出数据',
      clearAllData: '清空全部数据',
      search: '搜索',
      project: '项目',
      name: '名称',
      type: '类型',
      amount: '金额',
      status: '状态',
      actions: '操作',
      expected: '预期',
      actual: '实际',
      daily: '日收益',
      weekly: '周收益',
      monthly: '月收益',
      yearly: '年收益',
      total: '累计',
      email: '邮箱',
      password: '密码',
      confirmPassword: '确认密码',
      termsOfService: '服务条款',
      privacyPolicy: '隐私政策',
      providers: {
        google: 'Google',
        github: 'GitHub',
      },
      displayName: '显示名称',
      timezone: '时区',
      defaultCurrency: '默认币种',
      currency: '币种',
      profile: '个人资料',
      logout: '退出登录',
      notifications: '通知',
      displayPreferences: '显示偏好',
      dataManagement: '数据管理',
      orContinueWith: '或使用以下方式继续',
    },
    nav: {
      dashboard: '仪表盘',
      analytics: '分析',
      settings: '设置',
      login: '登录',
      getStarted: '立即开始',
      myAccount: '我的账户',
    },
    dashboard: {
      title: '投资仪表盘',
      subtitle: '追踪并管理你的 CeFi 与 DeFi 投资',
      portfolio: '投资组合',
    },
    stats: {
      totalInvestment: '总投资额',
      dailyIncome: '日收益',
      monthlyIncome: '月收益',
      averageApr: '平均 APR',
      activePositions: '{count} 个活跃仓位',
      weeklyIncome: '周收益 {value}',
      yearlyIncome: '年收益 {value}',
      acrossAllPositions: '统计全部仓位',
    },
    filters: {
      searchInvestments: '搜索投资项目...',
      projectPlaceholder: '项目',
      typePlaceholder: '类型',
      statusPlaceholder: '状态',
      allProjects: '全部项目',
      allTypes: '全部类型',
      allStatus: '全部状态',
    },
    types: {
      interest: '固收',
      lp: 'LP',
      lending: '借贷',
      cedefi: 'CeDeFi',
    },
    statuses: {
      active: '进行中',
      ended: '已结束',
      early_ended: '提前结束',
      deleted: '已删除',
    },
    table: {
      activeInvestments: '进行中投资',
      activeInvestmentsDescription: '展示仍在持有的仓位、当前收益与开始时间。',
      historyInvestments: '已结束投资',
      historyInvestmentsDescription: '展示已结束或提前结束仓位的起止时间与结束信息。',
      noInvestmentsFound: '暂无投资记录',
      noActiveInvestments: '暂无进行中的投资记录',
      noHistoryInvestments: '暂无已结束的投资记录',
      deleteInvestment: '删除投资',
      deleteDescription: '确认删除 {project} - {name} 吗？',
      deleteAmount: '金额：{amount}',
      deletePermanent: '此操作无法撤销。',
      typeDeleteToConfirm: '请输入 {keyword} 以确认',
      endInvestmentEarly: '提前结束投资',
      endDescription: '确认提前结束 {project} - {name} 吗？',
      originalEndDate: '原结束日期：{date}',
      endHint: '该投资将被标记为已结束，收益计算也会停止。',
      endInvestment: '结束投资',
      openLink: '打开项目链接',
      finishDate: '结束日期',
      finalIncome: '最终累计收益',
      finalIncomeHint: '修改实际 APR 或最终收益时，另一项会自动联动。',
      actualAprLabel: '实际 APR (%)',
      actualAprHint: '根据本金和实际持有天数计算。',
      holdingDays: '实际持有天数：{days}',
      startDate: '开始时间',
      endDate: '结束时间',
      timeline: '起止时间',
      settlement: '结束信息',
      finalSettlement: '最终收益',
      earlyExitRemark: '提前结束备注',
      noRemark: '无备注',
      projectedDailyIncome: '最终日收益：{amount}',
      saveFinishChanges: '保存结束信息',
    },
    form: {
      addTitle: '新增投资',
      editTitle: '编辑投资',
      projectPlaceholder: '例如：Pendle',
      namePlaceholder: '例如：USDF PT',
      urlLabel: '链接（可选）',
      urlPlaceholder: 'https://...',
      selectType: '选择类型',
      selectCurrency: '选择币种',
      startDate: '开始日期',
      endDate: '结束日期',
      expectedApr: '预期 APR (%)',
      expectedIncome: '预期收入（可选）',
      expectedIncomePlaceholder: '已知最终收益时可填写',
      actualApr: '实际 APR (%) - 可选',
      actualAprPlaceholder: '留空则使用预期值',
      description: '描述',
      descriptionPlaceholder: '例如：PT 仓位',
      remark: '备注',
      remarkPlaceholder: '补充说明...',
    },
    validation: {
      projectRequired: '请输入项目名称',
      nameRequired: '请输入投资名称',
      urlInvalid: '请输入有效链接',
      amountPositive: '金额必须大于 0',
      currencyRequired: '请选择币种',
      startDateRequired: '请选择开始日期',
      endDateRequired: '请选择结束日期',
      aprNonNegative: 'APR 不能小于 0',
      incomeNonNegative: '收益不能小于 0',
      aprTooHigh: 'APR 数值过高，请确认',
      validEmail: '请输入有效邮箱地址',
      passwordMin: '密码至少需要 8 位',
      nameMin: '名称至少需要 2 个字符',
      acceptTerms: '请先同意条款',
      passwordsMismatch: '两次输入的密码不一致',
    },
    analytics: {
      title: '数据分析',
      subtitle: '分析你的投资表现与收益情况',
      earningsOverview: '收益概览',
      monthlyEarnings: '月收益',
      cumulative: '累计收益',
      monthly: '月度',
      projectedIncomeTrend: '预估收入趋势',
      projectedIncomeTrendDescription: '基于当前投资时间轴实时推导，可与上方已落库的真实快照历史对照查看。',
      snapshotTrend: '真实快照趋势',
      snapshotTrendDescription: '把每次定时任务采集到的当日、当周、当月预估收益单独存下来，与下面的推导图表分开展示。',
      captureSnapshot: '采集今日快照',
      latestSnapshotDaily: '最新日收益快照',
      latestSnapshotWeekly: '最新周收益快照',
      latestSnapshotMonthly: '最新月收益快照',
      latestSnapshotCumulative: '最新累计收益快照',
      snapshotDaily: '采集日收益',
      snapshotWeekly: '采集周收益',
      snapshotMonthly: '采集月收益',
      snapshotCumulative: '采集累计收益',
      loadingSnapshots: '正在加载快照历史...',
      loadingSnapshotsDescription: '正在读取已落库的每日快照。',
      noSnapshotData: '还没有真实快照数据',
      noSnapshotDataDescription: '你可以先手动采集一次，或者等定时任务写入第一条历史点。',
      portfolioIncomeVolatility: '资产收入波动',
      portfolioIncomeVolatilityDescription: '根据每日收入观察组合收入波动和累计变化。',
      dailyProjected: '预估日收益',
      weeklyProjected: '预估周收益',
      monthlyProjected: '预估月收益',
      dailyPortfolioIncome: '组合日收益',
      cumulativeProjectedIncome: '累计收益',
      activeCapital: '活跃本金',
      aprComparison: 'APR 对比',
      expectedApr: '预期 APR',
      actualApr: '实际 APR',
      expected: '预期',
      actual: '实际',
      portfolioAllocation: '仓位分布',
      totalInvested: '总投入',
      amount: '金额',
      dailyIncome: '日收益',
      weeklyIncome: '周收益',
      monthlyIncome: '月收益',
      yearlyIncome: '年收益',
    },
    settings: {
      title: '设置',
      subtitle: '管理你的账户与应用偏好',
      profileDescription: '管理你的账户信息',
      notificationsDescription: '配置你接收更新的方式',
      earningsUpdates: '收益更新',
      earningsUpdatesDescription: '收益计算后通知我',
      maturityAlerts: '到期提醒',
      maturityAlertsDescription: '投资即将到期时提醒我',
      weeklySummary: '周报摘要',
      weeklySummaryDescription: '接收每周表现总结',
      monthlyReport: '月度报告',
      monthlyReportDescription: '接收详细的月度投资报告',
      displayDescription: '自定义你的查看体验',
      dataManagementDescription: '导出或管理你的投资数据',
      namePlaceholder: '你的名字',
      emailPlaceholder: 'your@email.com',
      clearDataTitle: '你确定要这样做吗？',
      clearDataDescription: '此操作无法撤销，会永久删除当前设备上的全部投资数据。',
      deleteAllData: '删除全部数据',
      saveSuccess: '设置保存成功',
      exportSuccess: '数据导出成功',
      clearSuccess: '已清空全部数据',
      saveFailed: '保存设置失败。',
    },
    auth: {
      loginTitle: '欢迎回来',
      loginSubtitle: '登录后继续使用你的账户',
      registerTitle: '创建账户',
      registerSubtitle: '立即开始追踪你的投资',
      fullName: '姓名',
      fullNamePlaceholder: '张三',
      emailPlaceholder: 'you@example.com',
      passwordPlaceholder: '创建一个密码',
      currentPasswordPlaceholder: '输入你的密码',
      confirmPasswordPlaceholder: '再次输入密码',
      forgotPassword: '忘记密码？',
      signIn: '登录',
      signingIn: '登录中...',
      createAccount: '创建账户',
      creatingAccount: '创建中...',
      noAccount: '还没有账户？',
      alreadyHaveAccount: '已有账户？',
      signUp: '注册',
      signInLink: '去登录',
      loginSuccess: '登录成功',
      registerSuccess: '账户创建成功',
      loginFailed: '登录失败。',
      registerFailed: '注册失败。',
      agreeToTermsPrefix: '我同意',
      footerAgreement: '继续即表示你同意我们的',
      continueWithProvider: '使用 {provider} 继续',
    },
    passwordRules: {
      minLength: '至少 8 个字符',
      hasNumber: '包含数字',
      hasUppercase: '包含大写字母',
      hasLowercase: '包含小写字母',
    },
    errors: {
      emailRequired: '邮箱不能为空。',
      validEmail: '请输入有效邮箱地址。',
      passwordMin: '密码至少需要 8 位。',
      emailExists: '该邮箱已注册账户。',
      invalidCredentials: '邮箱或密码错误。',
      unauthorized: '未授权。',
      userNotFound: '用户不存在。',
      emailInUse: '该邮箱已被使用。',
      requestFailed: '请求失败。',
      loginFailed: '登录失败。',
      registrationFailed: '注册失败。',
      unsupportedOAuthProvider: '不支持的第三方登录提供商。',
      oauthProviderNotConfigured: '当前未配置第三方登录。',
      oauthStateInvalid: '第三方登录状态已失效，请重试。',
      oauthDenied: '你已取消第三方授权。',
      oauthFailed: '第三方登录失败。',
      googleEmailUnavailable: 'Google 账户邮箱不可用或未验证。',
      githubEmailUnavailable: 'GitHub 账户邮箱不可用或未验证。',
      oauthAccountIdRequired: '第三方账户标识不能为空。',
    },
  },
} as const

const serverErrorKeyMap: Record<string, string> = {
  'Email is required.': 'errors.emailRequired',
  'Please enter a valid email.': 'errors.validEmail',
  'Password must be at least 8 characters.': 'errors.passwordMin',
  'An account with this email already exists.': 'errors.emailExists',
  'Invalid email or password.': 'errors.invalidCredentials',
  'Unauthorized.': 'errors.unauthorized',
  'User not found.': 'errors.userNotFound',
  'Email is already in use.': 'errors.emailInUse',
  'Request failed.': 'errors.requestFailed',
  'Login failed.': 'errors.loginFailed',
  'Registration failed.': 'errors.registrationFailed',
  'Unsupported OAuth provider.': 'errors.unsupportedOAuthProvider',
  'OAuth provider is not configured.': 'errors.oauthProviderNotConfigured',
  'OAuth state is invalid or expired.': 'errors.oauthStateInvalid',
  'OAuth authorization was denied.': 'errors.oauthDenied',
  'OAuth sign in failed.': 'errors.oauthFailed',
  'Google account email is unavailable or not verified.': 'errors.googleEmailUnavailable',
  'GitHub account email is unavailable or not verified.': 'errors.githubEmailUnavailable',
  'OAuth account identifier is required.': 'errors.oauthAccountIdRequired',
}

function getNestedValue(target: Record<string, any>, key: string): string | undefined {
  return key.split('.').reduce<any>((current, segment) => current?.[segment], target)
}

function interpolate(template: string, params?: TranslationParams) {
  if (!params) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))
}

function getIntlLocale(locale: Locale) {
  return locale === 'zh' ? 'zh-CN' : 'en-US'
}

function hasTimeInfo(value: string | Date) {
  if (value instanceof Date) {
    return (
      value.getHours() !== 0 ||
      value.getMinutes() !== 0 ||
      value.getSeconds() !== 0
    )
  }

  return /[T ]\d{2}:\d{2}(:\d{2})?/.test(value)
}

function translate(locale: Locale, key: string, params?: TranslationParams) {
  const template =
    getNestedValue(translations[locale] as Record<string, any>, key) ??
    getNestedValue(translations.en as Record<string, any>, key) ??
    key

  return interpolate(template, params)
}

function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'zh'
}

function isDisplayCurrency(value: string | null | undefined): value is DisplayCurrency {
  return DISPLAY_CURRENCIES.includes(value as DisplayCurrency)
}

function convertFromUsdBase(value: number, currency: DisplayCurrency, usdToDisplayRate: number) {
  if (currency !== 'USD') {
    return value * usdToDisplayRate
  }

  return value
}

function getBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') {
    return 'en'
  }

  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  displayCurrency: DisplayCurrency
  setDisplayCurrency: (currency: DisplayCurrency) => void
  t: (key: string, params?: TranslationParams) => string
  formatCurrency: (value: number, currency?: string, maximumFractionDigits?: number) => string
  formatDisplayCurrency: (value: number, maximumFractionDigits?: number) => string
  convertDisplayValue: (value: number) => number
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string
  localizeErrorMessage: (message: string) => string
  getTypeLabel: (type: string) => string
  getStatusLabel: (status: string) => string
  getDeleteConfirmationKeyword: () => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')
  const [displayCurrency, setDisplayCurrencyState] = useState<DisplayCurrency>('USD')
  const [usdToDisplayRate, setUsdToDisplayRate] = useState(1)

  useEffect(() => {
    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    setLocaleState(isLocale(savedLocale) ? savedLocale : getBrowserLocale())

    const savedDisplayCurrency = window.localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY)
    setDisplayCurrencyState(isDisplayCurrency(savedDisplayCurrency) ? savedDisplayCurrency : 'USD')

    const savedExchangeRate = Number(window.localStorage.getItem(EXCHANGE_RATE_STORAGE_KEY))
    if (Number.isFinite(savedExchangeRate) && savedExchangeRate > 0) {
      setUsdToDisplayRate(savedExchangeRate)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  useEffect(() => {
    window.localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, displayCurrency)
  }, [displayCurrency])

  useEffect(() => {
    let isMounted = true

    async function loadExchangeRate() {
      try {
        if (displayCurrency === 'USD') {
          setUsdToDisplayRate(1)
          window.localStorage.setItem(EXCHANGE_RATE_STORAGE_KEY, '1')
          return
        }

        const response = await fetch(`/api/exchange-rate?base=USD&target=${displayCurrency}`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          return
        }

        const payload = await response.json()
        const nextRate = Number(payload?.rate)

        if (!isMounted || !Number.isFinite(nextRate) || nextRate <= 0) {
          return
        }

        setUsdToDisplayRate(nextRate)
        window.localStorage.setItem(EXCHANGE_RATE_STORAGE_KEY, String(nextRate))
      } catch {
        // Keep the last known rate when the remote API is temporarily unavailable.
      }
    }

    void loadExchangeRate()
    const intervalId = window.setInterval(loadExchangeRate, 5 * 60 * 1000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [displayCurrency])

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, params?: TranslationParams) => translate(locale, key, params)
    const formatCurrencyValue = (
      value: number,
      currency = 'USD',
      maximumFractionDigits = 2,
    ) =>
      new Intl.NumberFormat(getIntlLocale(locale), {
        style: 'currency',
        currency,
        minimumFractionDigits: Math.min(2, maximumFractionDigits),
        maximumFractionDigits,
      }).format(value)

    return {
      locale,
      setLocale: setLocaleState,
      displayCurrency,
      setDisplayCurrency: setDisplayCurrencyState,
      t,
      formatCurrency: formatCurrencyValue,
      formatDisplayCurrency: (value, maximumFractionDigits = 2) =>
        formatCurrencyValue(
          convertFromUsdBase(value, displayCurrency, usdToDisplayRate),
          displayCurrency,
          maximumFractionDigits,
        ),
      convertDisplayValue: (value) => convertFromUsdBase(value, displayCurrency, usdToDisplayRate),
      formatDate: (value, options) =>
        new Intl.DateTimeFormat(getIntlLocale(locale), {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          ...(hasTimeInfo(value)
            ? {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }
            : {}),
          ...options,
        }).format(typeof value === 'string' ? new Date(value) : value),
      localizeErrorMessage: (message) => {
        const key = serverErrorKeyMap[message]
        return key ? t(key) : message
      },
      getTypeLabel: (type) => t(`types.${type}`),
      getStatusLabel: (status) => t(`statuses.${status}`),
      getDeleteConfirmationKeyword: () => (locale === 'zh' ? '删除' : 'DELETE'),
    }
  }, [displayCurrency, locale, usdToDisplayRate])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider.')
  }

  return context
}
