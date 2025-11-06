import { LightningElement, api, track } from 'lwc';
import saveSignatureGeneric from '@salesforce/apex/SignaturePDFController.saveSignatureGeneric';
import cntNames from '@salesforce/apex/SignaturePDFController.contactNames';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CapturesDigitalSignature extends LightningElement {
  @api recordId;         // Contact Id
  @api pageName = 'BridgesEnrollmentPDF'; // default VF page
  @api pdfBaseName = 'Enrollment-Signed'; // default filename prefix

  canvas; context; drawing = false;
  @track showError = false;
  @track showLoading = false;

  signatureData;
  contactName = '';

  connectedCallback() {
    if (!this.recordId) return;
    cntNames({ contactId: this.recordId })
      .then(c => { if (c) this.contactName = `${c.FirstName ?? ''} ${c.LastName ?? ''}`.trim(); })
      .catch(e => console.error('Error fetching contact name:', e));
  }

  renderedCallback() {
    if (this.canvas) return;
    this.canvas = this.template.querySelector('canvas');
    this.canvas.width = 500; this.canvas.height = 150;
    this.context = this.canvas.getContext('2d');
    this.context.lineWidth = 2; this.context.strokeStyle = 'blue';

    this.canvas.addEventListener('mousedown', this.startDraw.bind(this));
    this.canvas.addEventListener('mousemove', this.draw.bind(this));
    this.canvas.addEventListener('mouseup', this.endDraw.bind(this));
    this.canvas.addEventListener('mouseleave', this.endDraw.bind(this));
    this.canvas.addEventListener('touchstart', this.touchStart.bind(this), { passive: true });
    this.canvas.addEventListener('touchmove', this.touchMove.bind(this), { passive: true });
    this.canvas.addEventListener('touchend', this.endDraw.bind(this), { passive: true });
  }

  startDraw(evt) { this.drawing = true; const { offsetX, offsetY } = evt; this.context.beginPath(); this.context.moveTo(offsetX, offsetY); }
  draw(evt) { if (!this.drawing) return; const { offsetX, offsetY } = evt; this.context.lineTo(offsetX, offsetY); this.context.stroke(); this.signatureData = this.canvas.toDataURL(); }
  endDraw() { this.drawing = false; }

  touchStart(evt) { const r = this.canvas.getBoundingClientRect(); const t = evt.touches[0]; this.drawing = true; this.context.beginPath(); this.context.moveTo(t.clientX - r.left, t.clientY - r.top); }
  touchMove(evt) { if (!this.drawing) return; const r = this.canvas.getBoundingClientRect(); const t = evt.touches[0]; this.context.lineTo(t.clientX - r.left, t.clientY - r.top); this.context.stroke(); this.signatureData = this.canvas.toDataURL(); }

  @api
  validate() {
    if (!this.signatureData || this.isCanvasBlank()) {
      this.showError = true;
      return { isValid: false, errorMessage: 'Please provide your signature before continuing' };
    }

    this.showError = false; this.showLoading = true;
    let base64Image = this.signatureData.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');

    return saveSignatureGeneric({
      contactId: this.recordId,
      data: base64Image,
      signedBy: this.contactName,
      pageName: this.pageName,
      pdfBaseName: this.pdfBaseName
    })
      .then(() => { this.showLoading = false; this.toast('Success', 'Signature saved and PDF generated.', 'success'); return { isValid: true }; })
      .catch(err => { console.error('Error saving signature:', err); this.showLoading = false; this.toast('Error', 'Could not save signature. Please try again.', 'error'); return { isValid: false, errorMessage: 'Could not save signature. Please try again.' }; });
  }

  isCanvasBlank() { const blank = document.createElement('canvas'); blank.width = this.canvas.width; blank.height = this.canvas.height; return this.canvas.toDataURL() === blank.toDataURL(); }

  toast(title, message, variant) { this.dispatchEvent(new ShowToastEvent({ title, message, variant })); }
}