
import { BillItem, Friend, TaxCategory, GST_RATE, PST_RATE, Settlement } from '../types';

export const getItemTaxRate = (item: BillItem): number => {
  if (item.isTaxIncluded) return 0;
  switch (item.taxCategory) {
    case TaxCategory.GST: return GST_RATE;
    case TaxCategory.GST_PST: return GST_RATE + PST_RATE;
    case TaxCategory.HST_13: return 0.13;
    case TaxCategory.CUSTOM: return item.customTaxRate || 0;
    default: return 0;
  }
};

export const calculateItemTotals = (items: BillItem[]) => {
  let subtotal = 0;
  let taxTotal = 0;

  items.forEach(item => {
    subtotal += item.price;
    taxTotal += item.price * getItemTaxRate(item);
  });

  return { subtotal, taxTotal, total: subtotal + taxTotal };
};

export const calculateIndividualCosts = (
  friends: Friend[],
  items: BillItem[],
  tipAmount: number
) => {
  const { total: billTotal } = calculateItemTotals(items);
  const costMap: Record<string, number> = {};
  
  friends.forEach(f => costMap[f.id] = 0);

  items.forEach(item => {
    if (item.sharedWith.length === 0) return;
    
    const taxRate = getItemTaxRate(item);
    const itemTotal = item.price * (1 + taxRate);
    
    const share = itemTotal / item.sharedWith.length;
    item.sharedWith.forEach(friendId => {
      costMap[friendId] += share;
    });
  });

  // Distribute tip proportionally to the share of the bill
  if (billTotal > 0) {
    friends.forEach(f => {
      const proportion = costMap[f.id] / billTotal;
      costMap[f.id] += proportion * tipAmount;
    });
  }

  return costMap;
};

export const solveDebts = (
  balances: Record<string, number>,
  friends: Friend[]
): Settlement[] => {
  const settleList: Settlement[] = [];
  
  // Merge balances for couples
  const processedBalances: Record<string, number> = {};
  const processedFriendIds = new Set<string>();
  const namesMap: Record<string, string> = {}; 

  friends.forEach(f => {
    if (processedFriendIds.has(f.id)) return;

    if (f.partnerId) {
      const partner = friends.find(p => p.id === f.partnerId);
      if (partner) {
        const combinedId = `couple_${f.id}_${partner.id}`;
        processedBalances[combinedId] = (balances[f.id] || 0) + (balances[partner.id] || 0);
        namesMap[combinedId] = `${f.name} & ${partner.name}`;
        processedFriendIds.add(f.id);
        processedFriendIds.add(partner.id);
      } else {
        processedBalances[f.id] = balances[f.id] || 0;
        namesMap[f.id] = f.name;
        processedFriendIds.add(f.id);
      }
    } else {
      processedBalances[f.id] = balances[f.id] || 0;
      namesMap[f.id] = f.name;
      processedFriendIds.add(f.id);
    }
  });

  const credit = Object.keys(processedBalances)
    .filter(id => processedBalances[id] > 0.01)
    .sort((a, b) => processedBalances[b] - processedBalances[a]);
  const debit = Object.keys(processedBalances)
    .filter(id => processedBalances[id] < -0.01)
    .sort((a, b) => processedBalances[a] - processedBalances[b]);

  let i = 0, j = 0;
  const tempBalances = { ...processedBalances };

  while (i < credit.length && j < debit.length) {
    const creditor = credit[i];
    const debtor = debit[j];
    const amount = Math.min(tempBalances[creditor], -tempBalances[debtor]);

    if (amount > 0.01) {
      settleList.push({
        from: debtor,
        to: creditor,
        fromName: namesMap[debtor],
        toName: namesMap[creditor],
        amount: Number(amount.toFixed(2))
      });
    }

    tempBalances[creditor] -= amount;
    tempBalances[debtor] += amount;

    if (tempBalances[creditor] < 0.01) i++;
    if (tempBalances[debtor] > -0.01) j++;
  }

  return settleList;
};

export const solveDebtsUnoptimized = (
  balances: Record<string, number>,
  friends: Friend[]
): Settlement[] => {
  const settleList: Settlement[] = [];
  
  // Merge balances for couples
  const processedBalances: Record<string, number> = {};
  const processedFriendIds = new Set<string>();
  const namesMap: Record<string, string> = {}; 

  friends.forEach(f => {
    if (processedFriendIds.has(f.id)) return;

    if (f.partnerId) {
      const partner = friends.find(p => p.id === f.partnerId);
      if (partner) {
        const combinedId = `couple_${f.id}_${partner.id}`;
        processedBalances[combinedId] = (balances[f.id] || 0) + (balances[partner.id] || 0);
        namesMap[combinedId] = `${f.name} & ${partner.name}`;
        processedFriendIds.add(f.id);
        processedFriendIds.add(partner.id);
      } else {
        processedBalances[f.id] = balances[f.id] || 0;
        namesMap[f.id] = f.name;
        processedFriendIds.add(f.id);
      }
    } else {
      processedBalances[f.id] = balances[f.id] || 0;
      namesMap[f.id] = f.name;
      processedFriendIds.add(f.id);
    }
  });

  const creditors = Object.keys(processedBalances)
    .filter(id => processedBalances[id] > 0.01)
    .map(id => ({ id, balance: processedBalances[id] }))
    .sort((a, b) => b.balance - a.balance);

  const debtors = Object.keys(processedBalances)
    .filter(id => processedBalances[id] < -0.01)
    .map(id => ({ id, balance: -processedBalances[id] }))
    .sort((a, b) => b.balance - a.balance);

  const totalCredit = creditors.reduce((sum, c) => sum + c.balance, 0);

  if (totalCredit > 0.01) {
    debtors.forEach(debtor => {
      creditors.forEach(creditor => {
        const shareOfDebt = debtor.balance * (creditor.balance / totalCredit);
        if (shareOfDebt > 0.01) {
          settleList.push({
            from: debtor.id,
            to: creditor.id,
            fromName: namesMap[debtor.id],
            toName: namesMap[creditor.id],
            amount: Number(shareOfDebt.toFixed(2))
          });
        }
      });
    });
  }

  return settleList;
};
