import { DeclarationSubmission, PackageItem, ValidationError } from './types';

export function validateSubmission(submission: DeclarationSubmission): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!submission.declarationNo || submission.declarationNo.trim() === '') {
    errors.push({
      field: 'declarationNo',
      message: '申报编号不能为空'
    });
  }

  if (!submission.submitter || submission.submitter.trim() === '') {
    errors.push({
      field: 'submitter',
      message: '提交人不能为空'
    });
  }

  if (!submission.submitTime) {
    errors.push({
      field: 'submitTime',
      message: '提交时间不能为空'
    });
  } else {
    const submitDate = new Date(submission.submitTime);
    if (isNaN(submitDate.getTime())) {
      errors.push({
        field: 'submitTime',
        message: '提交时间格式无效'
      });
    } else if (submitDate > new Date()) {
      errors.push({
        field: 'submitTime',
        message: '提交时间不能晚于当前时间'
      });
    }
  }

  if (!submission.packages || !Array.isArray(submission.packages) || submission.packages.length === 0) {
    errors.push({
      field: 'packages',
      message: '包裹列表不能为空'
    });
  } else {
    const itemNos = new Set<string>();
    submission.packages.forEach((pkg, index) => {
      const pkgErrors = validatePackageItem(pkg, index);
      errors.push(...pkgErrors);

      if (pkg.itemNo) {
        if (itemNos.has(pkg.itemNo)) {
          errors.push({
            field: `packages[${index}].itemNo`,
            rowIndex: index,
            message: `品项编号 ${pkg.itemNo} 重复`
          });
        } else {
          itemNos.add(pkg.itemNo);
        }
      }
    });
  }

  if (submission.totalAmount === undefined || submission.totalAmount === null) {
    errors.push({
      field: 'totalAmount',
      message: '订单总金额不能为空'
    });
  } else if (typeof submission.totalAmount !== 'number' || submission.totalAmount < 0) {
    errors.push({
      field: 'totalAmount',
      message: '订单总金额必须为非负数'
    });
  }

  return errors;
}

function validatePackageItem(pkg: PackageItem, index: number): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!pkg.itemNo || pkg.itemNo.trim() === '') {
    errors.push({
      field: `packages[${index}].itemNo`,
      rowIndex: index,
      message: '品项编号不能为空'
    });
  }

  if (!pkg.name || pkg.name.trim() === '') {
    errors.push({
      field: `packages[${index}].name`,
      rowIndex: index,
      message: '商品名称不能为空'
    });
  }

  if (!pkg.category || pkg.category.trim() === '') {
    errors.push({
      field: `packages[${index}].category`,
      rowIndex: index,
      message: '商品品类不能为空'
    });
  }

  if (pkg.quantity === undefined || pkg.quantity === null) {
    errors.push({
      field: `packages[${index}].quantity`,
      rowIndex: index,
      message: '数量不能为空'
    });
  } else if (!Number.isInteger(pkg.quantity) || pkg.quantity <= 0) {
    errors.push({
      field: `packages[${index}].quantity`,
      rowIndex: index,
      message: '数量必须为正整数'
    });
  }

  if (pkg.unitPrice === undefined || pkg.unitPrice === null) {
    errors.push({
      field: `packages[${index}].unitPrice`,
      rowIndex: index,
      message: '单价不能为空'
    });
  } else if (typeof pkg.unitPrice !== 'number' || pkg.unitPrice < 0) {
    errors.push({
      field: `packages[${index}].unitPrice`,
      rowIndex: index,
      message: '单价必须为非负数'
    });
  }

  if (!pkg.currency || pkg.currency.trim() === '') {
    errors.push({
      field: `packages[${index}].currency`,
      rowIndex: index,
      message: '货币类型不能为空'
    });
  }

  if (pkg.taxRate === undefined || pkg.taxRate === null) {
    errors.push({
      field: `packages[${index}].taxRate`,
      rowIndex: index,
      message: '税率不能为空'
    });
  } else if (typeof pkg.taxRate !== 'number' || pkg.taxRate < 0 || pkg.taxRate > 1) {
    errors.push({
      field: `packages[${index}].taxRate`,
      rowIndex: index,
      message: '税率必须在 0-1 之间'
    });
  }

  return errors;
}
