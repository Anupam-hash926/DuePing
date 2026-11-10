import React from 'react'

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  let style = 'bg-slate-100 text-slate-700 border-slate-300' // default DRAFT (grey)
  let label = status

  switch (status) {
    case 'DRAFT':
      style = 'bg-slate-100 text-slate-700 border-slate-300'
      label = 'Draft'
      break
    case 'SENT':
      style = 'bg-blue-50 text-blue-700 border-blue-200'
      label = 'Sent'
      break
    case 'PARTIALLY_PAID':
      style = 'bg-amber-50 text-amber-700 border-amber-200'
      label = 'Partially Paid'
      break
    case 'DISPUTED':
      style = 'bg-red-50 text-red-700 border-red-200'
      label = 'Disputed'
      break
    case 'PAID':
      style = 'bg-emerald-50 text-emerald-700 border-emerald-200'
      label = 'Paid'
      break
    case 'WRITTEN_OFF':
      style = 'bg-neutral-700 text-neutral-100 border-neutral-800'
      label = 'Written Off'
      break
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {label}
    </span>
  )
}

export const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  let style = 'bg-slate-100 text-slate-600 border-slate-200'
  switch (priority) {
    case 'LOW':
      style = 'bg-slate-100 text-slate-600 border-slate-200'
      break
    case 'MEDIUM':
      style = 'bg-sky-50 text-sky-700 border-sky-200'
      break
    case 'HIGH':
      style = 'bg-orange-50 text-orange-700 border-orange-200'
      break
    case 'CRITICAL':
      style = 'bg-rose-50 text-rose-700 border-rose-200 font-semibold'
      break
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style}`}>
      {priority}
    </span>
  )
}

export const RiskBadge: React.FC<{ risk: string }> = ({ risk }) => {
  let style = 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (risk === 'MEDIUM') {
    style = 'bg-amber-50 text-amber-700 border-amber-200'
  } else if (risk === 'HIGH') {
    style = 'bg-rose-50 text-rose-700 border-rose-200'
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {risk} RISK
    </span>
  )
}

export const PromiseBadge: React.FC<{ status: string }> = ({ status }) => {
  let style = 'bg-blue-50 text-blue-700 border-blue-200'
  switch (status) {
    case 'PENDING':
      style = 'bg-blue-50 text-blue-700 border-blue-200'
      break
    case 'KEPT':
      style = 'bg-emerald-50 text-emerald-700 border-emerald-200'
      break
    case 'MISSED':
      style = 'bg-rose-50 text-rose-700 border-rose-200'
      break
    case 'SUPERSEDED':
      style = 'bg-slate-100 text-slate-500 border-slate-200 line-through'
      break
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style}`}>
      {status}
    </span>
  )
}

export const BlockerBadge: React.FC<{ status: string }> = ({ status }) => {
  let style = 'bg-rose-50 text-rose-700 border-rose-200'
  switch (status) {
    case 'OPEN':
      style = 'bg-rose-50 text-rose-700 border-rose-200'
      break
    case 'IN_PROGRESS':
      style = 'bg-amber-50 text-amber-700 border-amber-200'
      break
    case 'RESOLVED':
      style = 'bg-emerald-50 text-emerald-700 border-emerald-200'
      break
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

