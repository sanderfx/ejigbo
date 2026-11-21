/* Gerador de PDF offline, sem bibliotecas externas.
   Cada pagina do documento e uma imagem JPEG incorporada no PDF.
   O texto do PDF nao e selecionavel; o arquivo pode ser impresso.
*/
(function(){
'use strict';
const W=1240,H=1754, M=95, PAGE_W=595.28, PAGE_H=841.89;
const encoder=new TextEncoder();
const bytes=(value)=>encoder.encode(value);
function concat(parts){let size=0;for(const b of parts)size+=b.length;const out=new Uint8Array(size);let at=0;for(const b of parts){out.set(b,at);at+=b.length}return out;}
function jpgBytes(canvas){const base64=canvas.toDataURL('image/jpeg',0.81).split(',')[1];const binary=atob(base64);const out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;}
function makePage(){const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');c.fillStyle='#ffffff';c.fillRect(0,0,W,H);c.fillStyle='#12233e';c.textBaseline='top';return {canvas,c,y:135};}
function renderDocument({texto,nome,cpf,assinatura,estudio}){
  const pages=[];let page=makePage();pages.push(page);
  function nextPage(){page=makePage();pages.push(page)}
  function ensure(height){if(page.y+height>H-135)nextPage()}
  function drawLine(str,{size=23,bold=false,color='#25354d',space=10}={}){
    const ctx=page.c;ctx.font=(bold?'bold ':'')+size+'px Arial, sans-serif';
    const maxW=W-2*M, words=String(str).split(/\s+/).filter(Boolean);
    let line='';const rows=[];
    for(const word of words){const candidate=line?line+' '+word:word;
      if(ctx.measureText(candidate).width>maxW && line){rows.push(line);line=word}else{line=candidate}
    }
    if(line)rows.push(line);if(!rows.length)rows.push('');
    const lineHeight=Math.round(size*1.5);
    for(const part of rows){ensure(lineHeight);ctx.fillStyle=color;ctx.font=(bold?'bold ':'')+size+'px Arial, sans-serif';ctx.fillText(part,M,page.y);page.y+=lineHeight;}
    page.y+=space;
  }
  function heading(){
    const c=page.c;c.fillStyle='#ff891c';c.fillRect(M,62,70,9);c.fillStyle='#14243c';
    c.font='bold 34px Arial, sans-serif';c.fillText('CONTRATO DE FOTOGRAFIA',M,83);
    c.font='19px Arial, sans-serif';c.fillStyle='#56657c';c.fillText('FotoPro  |  '+String(estudio).slice(0,70),M,127);page.y=195;
  }
  heading();
  for(const p of String(texto).split(/\r?\n/)){
    if(!p.trim()){page.y+=17;continue}
    drawLine(p,{size:23,space:12});
  }
  ensure(390);
  page.y+=17;
  drawLine('ASSINATURA DO CONTRATANTE',{size:26,bold:true,color:'#12233e',space:14});
  const sigImg=new Image();
  // Signature is a data URL created in the click handler. Image drawing is asynchronous.
  return new Promise((resolve,reject)=>{
    sigImg.onload=()=>{
      const c=page.c;
      c.strokeStyle='#a3afbd';c.lineWidth=2;c.strokeRect(M,page.y,W-2*M,170);
      c.drawImage(sigImg,M+20,page.y+6,W-2*M-40,156);
      page.y+=190;
      drawLine('Nome: '+nome,{size:21,space:0});
      drawLine('CPF: '+cpf,{size:21,space:0});
      drawLine('Aceite em: '+new Date().toLocaleString('pt-BR'),{size:21,space:0});
      pages.forEach((pg,i)=>{
        const c=pg.c;c.fillStyle='#d9e0e8';c.fillRect(M,H-94,W-2*M,2);
        c.font='18px Arial, sans-serif';c.fillStyle='#637185';
        c.fillText('Gerado no dispositivo do cliente • Sem verificacao de identidade',M,H-77);
        c.fillText(`${i+1}/${pages.length}`,W-M-42,H-77);
      });
      resolve(pages.map(pg=>jpgBytes(pg.canvas)));
    };
    sigImg.onerror=()=>reject(new Error('Nao foi possivel ler a assinatura.'));
    sigImg.src=assinatura;
  });
}
function pdfFromImages(images){
  const objects=[null];
  function add(content){objects.push(content);return objects.length-1}
  const catalog=add(null),pages=add(null),kids=[];
  for(const img of images){
    const imageId=add({head:`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`,stream:img,tail:'\nendstream'});
    const content=bytes(`q\n${PAGE_W} 0 0 ${PAGE_H} 0 0 cm\n/Im${imageId} Do\nQ\n`);
    const contentId=add({head:`<< /Length ${content.length} >>\nstream\n`,stream:content,tail:'endstream'});
    const id=add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im${imageId} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    kids.push(`${id} 0 R`);
  }
  objects[catalog]=`<< /Type /Catalog /Pages ${pages} 0 R >>`;
  objects[pages]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  const parts=[bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];let position=parts[0].length;const offsets=[0];
  function push(x){parts.push(x);position+=x.length}
  objects.slice(1).forEach((obj,index)=>{
    offsets.push(position);push(bytes(`${index+1} 0 obj\n`));
    if(typeof obj==='string')push(bytes(obj));
    else{push(bytes(obj.head));push(obj.stream);push(bytes(obj.tail));}
    push(bytes('\nendobj\n'));
  });
  const xref=position;push(bytes(`xref\n0 ${objects.length}\n0000000000 65535 f \n`));
  for(let i=1;i<objects.length;i++)push(bytes(String(offsets[i]).padStart(10,'0')+' 00000 n \n'));
  push(bytes(`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return new Blob(parts,{type:'application/pdf'});
}
window.FotoProPDF={create:async(opts)=>pdfFromImages(await renderDocument(opts))};
})();
