const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Helper to resolve asset paths reliably
const getAssetPath = (filename) => {
  const backendPath = path.join(__dirname, '../assets', filename);
  if (fs.existsSync(backendPath)) return backendPath;
  const frontendPath = path.join(__dirname, '../../frontend/public', filename);
  if (fs.existsSync(frontendPath)) return frontendPath;
  return null;
};

/**
 * Convert number to Indian Rupee Words
 */
function numberToWordsINR(num) {
  if (!num || num === 0) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    let str = '';
    if (n >= 10000000) {
      str += inWords(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      str += inWords(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      str += inWords(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (n >= 100) {
      str += inWords(Math.floor(n / 100)) + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (n < 20) str += a[n] + ' ';
      else str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '') + ' ';
    }
    return str.trim();
  };

  return inWords(Math.round(num));
}

/**
 * Format currency with Indian Comma System
 */
function formatINR(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generate Invoice PDF Stream - Strictly 1 Page A4 with Logos & Higai Automation branding
 */
exports.generateInvoicePDF = (invoice, client, res) => {
  const doc = new PDFDocument({
    margin: 25,
    size: 'A4',
    bufferPages: true,
    autoFirstPage: true
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=Invoice-${invoice.invoiceNumber}.pdf`);

  doc.pipe(res);

  const leftMargin = 35;
  const rightEdge = 560;
  const contentWidth = rightEdge - leftMargin;

  // ==========================
  // 1. HEADER SECTION (Logo & Title)
  // ==========================
  const logoTop = 28;
  const royalLogoPath = getAssetPath('logo_royal.jpeg') || getAssetPath('logo.jpg');

  if (royalLogoPath) {
    try {
      doc.image(royalLogoPath, leftMargin, logoTop, { width: 44, height: 44 });
    } catch (e) {
      // Fallback shape if image load fails
      doc.roundedRect(leftMargin, logoTop, 44, 44, 6).fill('#0A1E3F');
    }
  }

  // Company Name & Subtitles next to logo
  const titleX = royalLogoPath ? leftMargin + 52 : leftMargin;
  doc
    .fillColor('#0A1E3F')
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('ROYAL ACCOUNTING', titleX, logoTop);

  doc
    .fillColor('#C59B27')
    .fontSize(8)
    .font('Helvetica-Bold')
    .text('GST & TAX CONSULTANCY SERVICES', titleX, logoTop + 15);

  doc
    .fillColor('#475569')
    .fontSize(7.5)
    .font('Helvetica')
    .text('Ph: +91 99943 60994  •  Email: royallogu2026@gmail.com  •  Tamil Nadu', titleX, logoTop + 26);

  // Invoice Title & Number (Top Right)
  doc
    .fillColor('#0A1E3F')
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('TAX INVOICE', 320, logoTop, { align: 'right', width: 240 });

  doc
    .fillColor('#334155')
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(`Invoice No : ${invoice.invoiceNumber}`, 300, logoTop + 24, { align: 'right', width: 260 });

  // Top Divider
  doc
    .moveTo(leftMargin, logoTop + 48)
    .lineTo(rightEdge, logoTop + 48)
    .strokeColor('#0A1E3F')
    .lineWidth(1.5)
    .stroke();

  // ==========================
  // 2. BILL TO & DATES SECTION
  // ==========================
  const billTop = logoTop + 56;

  // Bill To (Left Box)
  doc
    .fillColor('#64748B')
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text('BILL TO:', leftMargin, billTop);

  doc
    .fillColor('#0A1E3F')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text((client.clientName || 'Valued Client').toUpperCase(), leftMargin, billTop + 11);

  if (client.tradeName && client.tradeName !== client.clientName) {
    doc
      .fillColor('#475569')
      .fontSize(8)
      .font('Helvetica')
      .text(`Trade: ${client.tradeName}`, leftMargin, billTop + 23);
  }

  const addressText = client.address
    ? `${client.address}, ${client.city || ''} ${client.state || ''}`
    : 'Tamil Nadu, India';

  doc
    .fillColor('#475569')
    .fontSize(7.5)
    .font('Helvetica')
    .text(addressText, leftMargin, billTop + 33, { width: 240 })
    .text(`Mobile: ${client.phone || 'N/A'}  ${client.email ? ' | ' + client.email : ''}`, leftMargin, billTop + 43);

  if (client.gstin) {
    doc
      .fillColor('#0A1E3F')
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .text(`GSTIN: ${client.gstin}   PAN: ${client.pan || 'N/A'}`, leftMargin, billTop + 53);
  }

  // Invoice Meta Dates (Right Box)
  const dateBoxX = 360;
  const dateBoxW = 200;

  doc
    .fillColor('#475569')
    .fontSize(8)
    .font('Helvetica')
    .text('Invoice Date :', dateBoxX, billTop)
    .font('Helvetica-Bold')
    .fillColor('#0F172A')
    .text(
      invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
      dateBoxX + 70,
      billTop,
      { align: 'right', width: dateBoxW - 70 }
    );

  const planText = invoice.billingCycle ? `${invoice.billingCycle} Plan` : 'Monthly Plan';
  doc
    .font('Helvetica')
    .fillColor('#475569')
    .text('Billing Plan :', dateBoxX, billTop + 14)
    .font('Helvetica-Bold')
    .fillColor('#0F172A')
    .text(planText, dateBoxX + 70, billTop + 14, { align: 'right', width: dateBoxW - 70 });

  doc
    .font('Helvetica')
    .fillColor('#475569')
    .text('Due Date :', dateBoxX, billTop + 28)
    .font('Helvetica-Bold')
    .fillColor('#0F172A')
    .text(
      invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
      dateBoxX + 70,
      billTop + 28,
      { align: 'right', width: dateBoxW - 70 }
    );

  // Status Badge
  const statusColor =
    invoice.paymentStatus === 'Paid'
      ? '#15803D'
      : invoice.paymentStatus === 'Partial'
      ? '#D97706'
      : '#0A1E3F';

  doc
    .roundedRect(rightEdge - 75, billTop + 44, 75, 17, 3)
    .fill(statusColor);

  doc
    .fillColor('#FFFFFF')
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text((invoice.paymentStatus || 'PENDING').toUpperCase(), rightEdge - 75, billTop + 49, {
      width: 75,
      align: 'center'
    });

  // ==========================
  // 3. ITEMS TABLE
  // ==========================
  const tableTop = billTop + 68;
  const colX = {
    sno: leftMargin + 6,
    desc: leftMargin + 28,
    hsn: 290,
    rate: 350,
    qty: 430,
    amount: 480
  };

  // Table Header Container
  doc
    .rect(leftMargin, tableTop, contentWidth, 20)
    .fill('#0A1E3F');

  // Header Texts
  doc
    .fillColor('#FFFFFF')
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text('#', colX.sno, tableTop + 6)
    .text('Item & Description', colX.desc, tableTop + 6)
    .text('HSN/SAC', colX.hsn, tableTop + 6)
    .text('Rate (Rs.)', colX.rate, tableTop + 6, { width: 65, align: 'right' })
    .text('Qty', colX.qty, tableTop + 6, { width: 35, align: 'right' })
    .text('Amount (Rs.)', colX.amount, tableTop + 6, { width: 75, align: 'right' });

  // Rows
  let curY = tableTop + 20;
  const items = invoice.items && invoice.items.length > 0 ? invoice.items : [{ description: invoice.serviceType || 'Professional Services', hsnSac: '998231', quantity: 1, rate: invoice.subTotal || invoice.total, amount: invoice.total }];

  items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    const rowH = 22;

    if (isEven) {
      doc
        .rect(leftMargin, curY, contentWidth, rowH)
        .fill('#F8FAFC');
    }

    doc
      .fillColor('#334155')
      .fontSize(7.5)
      .font('Helvetica')
      .text(String(index + 1), colX.sno, curY + 6)
      .font('Helvetica-Bold')
      .text(item.description || item.serviceName || 'Professional Service', colX.desc, curY + 6, { width: 235 })
      .font('Helvetica')
      .text(item.hsnSac || '9982', colX.hsn, curY + 6)
      .text(formatINR(item.rate || item.unitPrice || item.amount || 0), colX.rate, curY + 6, { width: 65, align: 'right' })
      .text(String(item.quantity || 1), colX.qty, curY + 6, { width: 35, align: 'right' })
      .font('Helvetica-Bold')
      .text(formatINR(item.amount || (item.quantity ? item.quantity * item.rate : item.rate) || 0), colX.amount, curY + 6, { width: 75, align: 'right' });

    // Row Bottom Border
    doc
      .moveTo(leftMargin, curY + rowH)
      .lineTo(rightEdge, curY + rowH)
      .strokeColor('#E2E8F0')
      .lineWidth(0.5)
      .stroke();

    curY += rowH;
  });

  // Table Outer Frame Box
  doc
    .rect(leftMargin, tableTop, contentWidth, curY - tableTop)
    .strokeColor('#CBD5E1')
    .lineWidth(0.6)
    .stroke();

  // ==========================
  // 4. SUMMARY & TOTALS SECTION
  // ==========================
  const sumTop = curY + 10;
  const labelX = 330;
  const valX = 445;
  const valW = 110;

  // Sub Total
  doc
    .fillColor('#475569')
    .fontSize(8)
    .font('Helvetica')
    .text('Sub Total', labelX, sumTop)
    .font('Helvetica-Bold')
    .fillColor('#0F172A')
    .text(`Rs. ${formatINR(invoice.subTotal || invoice.total)}`, valX, sumTop, { align: 'right', width: valW });

  // GST / Taxes if applicable
  let nextSumY = sumTop + 14;
  if (invoice.gstPercent && invoice.gstPercent > 0) {
    doc
      .fillColor('#475569')
      .fontSize(8)
      .font('Helvetica')
      .text(`GST (${invoice.gstPercent}%)`, labelX, nextSumY)
      .font('Helvetica-Bold')
      .fillColor('#0F172A')
      .text(`Rs. ${formatINR(invoice.gstAmount || 0)}`, valX, nextSumY, { align: 'right', width: valW });
    nextSumY += 14;
  }

  // Total
  doc
    .fillColor('#0F172A')
    .fontSize(8.5)
    .font('Helvetica-Bold')
    .text('Grand Total', labelX, nextSumY)
    .text(`Rs. ${formatINR(invoice.total)}`, valX, nextSumY, { align: 'right', width: valW });

  // Payment Made
  const paid = Number(invoice.paidAmount) || 0;
  nextSumY += 14;
  doc
    .fillColor('#475569')
    .fontSize(8)
    .font('Helvetica-Bold')
    .text('Payment Made', labelX, nextSumY)
    .fillColor('#15803D')
    .text(`(-) Rs. ${formatINR(paid)}`, valX, nextSumY, { align: 'right', width: valW });

  // Balance Due Box
  const balanceDue = Math.max(0, (invoice.total || 0) - paid);
  const balBarTop = nextSumY + 16;
  doc
    .rect(300, balBarTop, 260, 20)
    .fill('#0A1E3F');

  doc
    .fillColor('#FFFFFF')
    .fontSize(8.5)
    .font('Helvetica-Bold')
    .text('Balance Due', 315, balBarTop + 5)
    .text(`Rs. ${formatINR(balanceDue)}`, valX, balBarTop + 5, { align: 'right', width: valW });

  // Total In Words (Left of totals)
  const wordsStr = `Rupees ${numberToWordsINR(invoice.total)} Only`;
  doc
    .fillColor('#64748B')
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text('TOTAL IN WORDS:', leftMargin, sumTop)
    .font('Helvetica-BoldOblique')
    .fillColor('#0A1E3F')
    .text(wordsStr, leftMargin, sumTop + 12, { width: 250 });

  // Notes
  doc
    .fillColor('#64748B')
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text('NOTES & TERMS:', leftMargin, sumTop + 35)
    .font('Helvetica')
    .fillColor('#475569')
    .text('Thank you for trusting Royal Accounting. Payments can be made via UPI or Bank Transfer.', leftMargin, sumTop + 46, { width: 250 });

  // ==========================
  // 5. SIGNATURE SECTION
  // ==========================
  const signTop = balBarTop + 38;

  doc
    .fillColor('#0A1E3F')
    .fontSize(8.5)
    .font('Helvetica-Bold')
    .text('For ROYAL ACCOUNTING', rightEdge - 150, signTop, { width: 150, align: 'center' });

  doc
    .moveTo(rightEdge - 150, signTop + 40)
    .lineTo(rightEdge, signTop + 40)
    .strokeColor('#0A1E3F')
    .lineWidth(0.8)
    .stroke();

  doc
    .fillColor('#475569')
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text('Authorized Signatory', rightEdge - 150, signTop + 44, { width: 150, align: 'center' });

  // ==========================
  // 6. BOTTOM FOOTER WITH HIG LOGO & "Developed by Higai Automation"
  // ==========================
  const footerLineY = 740;
  doc
    .moveTo(leftMargin, footerLineY)
    .lineTo(rightEdge, footerLineY)
    .strokeColor('#E2E8F0')
    .lineWidth(0.8)
    .stroke();

  const higLogoPath = getAssetPath('hig_logo.jpeg');
  const higImgY = footerLineY + 6;

  if (higLogoPath) {
    try {
      const higWidth = 24;
      const higHeight = 24;
      const higX = (595.28 - higWidth) / 2;
      doc.image(higLogoPath, higX, higImgY, { width: higWidth, height: higHeight });
    } catch (e) {}
  }

  // Developer text in center bottom phase
  doc
    .fillColor('#64748B')
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text('Developed by Higai Automation', 0, higImgY + 28, { align: 'center', width: 595.28 });

  doc.end();
};

