import { useState, useCallback } from 'react';
import type { InvoiceApplication, Customer, Project, DashboardStats } from '../types';
import { sampleInvoices, sampleCustomers, sampleProjects } from '../data/sampleData';
import { generateId, validateInvoiceApplication, createOperationLog, getObjectDiff } from '../utils';

export const useInvoiceStore = () => {
  const [invoices, setInvoices] = useState<InvoiceApplication[]>(sampleInvoices);
  const [customers, setCustomers] = useState<Customer[]>(sampleCustomers);
  const [projects] = useState<Project[]>(sampleProjects);
  const [currentUser] = useState('财务王经理');

  const getDashboardStats = useCallback((): DashboardStats => {
    const pending = invoices.filter(inv => inv.status === 'pending').length;
    const completed = invoices.filter(inv => 
      ['approved', 'invoiced', 'reopened'].includes(inv.status)
    ).length;
    const blocked = invoices.filter(inv => inv.status === 'blocked').length;
    return {
      pending,
      completed,
      blocked,
      total: invoices.length
    };
  }, [invoices]);

  const createInvoice = useCallback((invoiceData: Partial<InvoiceApplication>): InvoiceApplication => {
    const newId = generateId();
    const validation = validateInvoiceApplication(invoiceData, invoices);
    
    const newInvoice: InvoiceApplication = {
      id: newId,
      customerId: invoiceData.customerId || '',
      customerName: invoiceData.customerName || '',
      taxId: invoiceData.taxId || '',
      address: invoiceData.address,
      phone: invoiceData.phone,
      bankName: invoiceData.bankName,
      bankAccount: invoiceData.bankAccount,
      projectId: invoiceData.projectId || '',
      projectName: invoiceData.projectName || '',
      projectCode: invoiceData.projectCode || '',
      amount: invoiceData.amount || 0,
      invoiceType: invoiceData.invoiceType || 'special',
      status: validation.valid ? 'pending' : 'blocked',
      blockReason: !validation.valid ? validation.blockReason : undefined,
      blockMessage: !validation.valid ? validation.blockMessage : undefined,
      applicant: currentUser,
      applyTime: new Date().toISOString(),
      isRedFlush: false,
      isReopened: false,
      operationLogs: [
        createOperationLog(newId, currentUser, '提交申请', validation.valid ? '新建开票申请' : validation.blockMessage)
      ]
    };

    setInvoices(prev => [...prev, newInvoice]);
    return newInvoice;
  }, [invoices, currentUser]);

  const updateInvoice = useCallback((id: string, updates: Partial<InvoiceApplication>): boolean => {
    const invoice = invoices.find(inv => inv.id === id);
    if (!invoice) return false;

    const validation = validateInvoiceApplication(
      { ...invoice, ...updates },
      invoices.filter(inv => inv.id !== id)
    );

    if (!validation.valid) {
      setInvoices(prev => prev.map(inv => 
        inv.id === id 
          ? {
              ...inv,
              ...updates,
              status: 'blocked',
              blockReason: validation.blockReason,
              blockMessage: validation.blockMessage,
              operationLogs: [
                ...inv.operationLogs,
                createOperationLog(id, currentUser, '更新被拦截', validation.blockMessage)
              ]
            }
          : inv
      ));
      return false;
    }

    setInvoices(prev => prev.map(inv => 
      inv.id === id 
        ? {
            ...inv,
            ...updates,
            operationLogs: [
              ...inv.operationLogs,
              createOperationLog(id, currentUser, '更新申请', '修改开票申请信息')
            ]
          }
        : inv
    ));
    return true;
  }, [invoices, currentUser]);

  const approveInvoice = useCallback((id: string, remark?: string): boolean => {
    setInvoices(prev => prev.map(inv => 
      inv.id === id 
        ? {
            ...inv,
            status: 'approved',
            reviewer: currentUser,
            reviewTime: new Date().toISOString(),
            operationLogs: [
              ...inv.operationLogs,
              createOperationLog(id, currentUser, '审核通过', remark)
            ]
          }
        : inv
    ));
    return true;
  }, [currentUser]);

  const rejectInvoice = useCallback((id: string, remark: string): boolean => {
    setInvoices(prev => prev.map(inv => 
      inv.id === id 
        ? {
            ...inv,
            status: 'rejected',
            reviewer: currentUser,
            reviewTime: new Date().toISOString(),
            operationLogs: [
              ...inv.operationLogs,
              createOperationLog(id, currentUser, '驳回申请', remark)
            ]
          }
        : inv
    ));
    return true;
  }, [currentUser]);

  const markAsInvoiced = useCallback((id: string, invoiceNumber: string): boolean => {
    setInvoices(prev => prev.map(inv => 
      inv.id === id 
        ? {
            ...inv,
            status: 'invoiced',
            invoiceNumber,
            invoiceTime: new Date().toISOString(),
            operationLogs: [
              ...inv.operationLogs,
              createOperationLog(id, currentUser, '已开票', `发票号：${invoiceNumber}`)
            ]
          }
        : inv
    ));
    return true;
  }, [currentUser]);

  const redFlushInvoice = useCallback((id: string, remark?: string): boolean => {
    setInvoices(prev => prev.map(inv => 
      inv.id === id 
        ? {
            ...inv,
            status: 'red_flush',
            redFlushTime: new Date().toISOString(),
            isRedFlush: true,
            operationLogs: [
              ...inv.operationLogs,
              createOperationLog(id, currentUser, '红冲发票', remark)
            ]
          }
        : inv
    ));
    return true;
  }, [currentUser]);

  const reopenInvoice = useCallback((originalId: string, newInvoiceData: Partial<InvoiceApplication>): InvoiceApplication => {
    const originalInvoice = invoices.find(inv => inv.id === originalId);
    if (!originalInvoice) throw new Error('原发票不存在');

    const newId = generateId();
    const newInvoice: InvoiceApplication = {
      id: newId,
      customerId: newInvoiceData.customerId || originalInvoice.customerId,
      customerName: newInvoiceData.customerName || originalInvoice.customerName,
      taxId: newInvoiceData.taxId || originalInvoice.taxId,
      address: newInvoiceData.address || originalInvoice.address,
      phone: newInvoiceData.phone || originalInvoice.phone,
      bankName: newInvoiceData.bankName || originalInvoice.bankName,
      bankAccount: newInvoiceData.bankAccount || originalInvoice.bankAccount,
      projectId: originalInvoice.projectId,
      projectName: originalInvoice.projectName,
      projectCode: originalInvoice.projectCode,
      amount: newInvoiceData.amount || originalInvoice.amount,
      invoiceType: newInvoiceData.invoiceType || originalInvoice.invoiceType,
      status: 'reopened',
      applicant: currentUser,
      applyTime: new Date().toISOString(),
      reviewer: currentUser,
      reviewTime: new Date().toISOString(),
      originalInvoiceId: originalId,
      reopenTime: new Date().toISOString(),
      isRedFlush: false,
      isReopened: true,
      operationLogs: [
        createOperationLog(newId, currentUser, '重开发票', `原发票号：${originalInvoice.invoiceNumber || originalId}`)
      ]
    };

    setInvoices(prev => [
      ...prev.map(inv => 
        inv.id === originalId 
          ? { ...inv, isReopened: true }
          : inv
      ),
      newInvoice
    ]);

    return newInvoice;
  }, [invoices, currentUser]);

  const unblockInvoice = useCallback((id: string): boolean => {
    const invoice = invoices.find(inv => inv.id === id);
    if (!invoice) return false;

    const validation = validateInvoiceApplication(invoice, invoices.filter(inv => inv.id !== id));
    
    if (!validation.valid) {
      setInvoices(prev => prev.map(inv => 
        inv.id === id 
          ? {
              ...inv,
              blockReason: validation.blockReason,
              blockMessage: validation.blockMessage,
              operationLogs: [
                ...inv.operationLogs,
                createOperationLog(id, currentUser, '解除拦截失败', validation.blockMessage)
              ]
            }
          : inv
      ));
      return false;
    }

    setInvoices(prev => prev.map(inv => 
      inv.id === id 
        ? {
            ...inv,
            status: 'pending',
            blockReason: undefined,
            blockMessage: undefined,
            operationLogs: [
              ...inv.operationLogs,
              createOperationLog(id, currentUser, '解除拦截', '问题已解决，恢复待审核状态')
            ]
          }
        : inv
    ));
    return true;
  }, [invoices, currentUser]);

  const addCustomer = useCallback((customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Customer => {
    const newCustomer: Customer = {
      ...customerData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setCustomers(prev => [...prev, newCustomer]);
    return newCustomer;
  }, []);

  const updateCustomer = useCallback((id: string, updates: Partial<Customer>): boolean => {
    const oldCustomer = customers.find(c => c.id === id);
    if (!oldCustomer) return false;

    const diffs = getObjectDiff(oldCustomer, updates);
    if (diffs.length === 0) return true;

    const diffSummary = diffs.map(d => `${d.field}: ${d.oldValue} → ${d.newValue}`).join('; ');

    setCustomers(prev => prev.map(cust => 
      cust.id === id 
        ? { ...cust, ...updates, updatedAt: new Date().toISOString() }
        : cust
    ));

    setInvoices(prev => prev.map(inv => {
      if (inv.customerId !== id) return inv;
      
      const customerUpdates: Partial<InvoiceApplication> = {};
      if (updates.name !== undefined) customerUpdates.customerName = updates.name;
      if (updates.taxId !== undefined) customerUpdates.taxId = updates.taxId;
      if (updates.address !== undefined) customerUpdates.address = updates.address;
      if (updates.phone !== undefined) customerUpdates.phone = updates.phone;
      if (updates.bankName !== undefined) customerUpdates.bankName = updates.bankName;
      if (updates.bankAccount !== undefined) customerUpdates.bankAccount = updates.bankAccount;

      const newLogs = [...inv.operationLogs];
      
      diffs.forEach(diff => {
        newLogs.push(createOperationLog(
          inv.id,
          currentUser,
          '客户信息变更',
          `由于客户资料更新，${diffSummary}`,
          diff.oldValue,
          diff.newValue
        ));
      });

      if (['invoiced', 'red_flush', 'reopened'].includes(inv.status)) {
        return {
          ...inv,
          ...customerUpdates,
          status: 'blocked' as const,
          blockReason: 'already_invoiced' as const,
          blockMessage: '已开票/红冲发票的客户信息已变更，建议走红冲重开流程',
          operationLogs: newLogs
        };
      }

      return {
        ...inv,
        ...customerUpdates,
        operationLogs: newLogs
      };
    }));

    return true;
  }, [customers, invoices, currentUser]);

  return {
    invoices,
    customers,
    projects,
    currentUser,
    getDashboardStats,
    createInvoice,
    updateInvoice,
    approveInvoice,
    rejectInvoice,
    markAsInvoiced,
    redFlushInvoice,
    reopenInvoice,
    unblockInvoice,
    addCustomer,
    updateCustomer
  };
};
