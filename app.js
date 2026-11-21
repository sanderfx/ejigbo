const CONFIG = window.FOTOPRO_CONFIG;
if (!CONFIG) throw new Error("Arquivo config.js nao encontrado.");
const el = x=>document.getElementById(x);
const ctx=el('sig').getContext('2d'); const canvas=el('sig'); let drew=false,active=false,pdfBlob=null,pdfName='';
function setupCanvas(){ const rect=canvas.getBoundingClientRect(), scale=Math.max(2,window.devicePixelRatio||1); const old=drew?canvas.toDataURL():null; canvas.width=Math.round(rect.width*scale); canvas.height=Math.round(180*scale); ctx.setTransform(scale,0,0,scale,0,0);ctx.strokeStyle='#122037';ctx.lineWidth=2.3;ctx.lineCap='round';ctx.lineJoin='round';if(old){let im=new Image();im.onload=()=>ctx.drawImage(im,0,0,rect.width,180);im.src=old;}}
function point(e){let r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);active=true;const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.1,p.y+.1);ctx.stroke();drew=true});canvas.addEventListener('pointermove',e=>{if(!active)return;e.preventDefault();const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke()});['pointerup','pointercancel','lostpointercapture'].forEach(v=>canvas.addEventListener(v,()=>active=false));
el('clear').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);drew=false};
const clean=s=>s.replace(/[\x00-\x1f<>]/g,'').trim();
function cpfValido(c){c=c.replace(/\D/g,'');if(!/^\d{11}$/.test(c)||/^(\d)\1{10}$/.test(c))return false;for(let t=9;t<11;t++){let s=0;for(let i=0;i<t;i++)s+=Number(c[i])*(t+1-i);let d=(s*10)%11;if(d===10)d=0;if(d!==Number(c[t]))return false}return true}
function formatCpf(s){let d=s.replace(/\D/g,'').slice(0,11);return d.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2')}
el('cpf').addEventListener('input',e=>e.target.value=formatCpf(e.target.value));
function texto(nome,cpf){return CONFIG.textoContrato.replaceAll('{{NOME}}',nome).replaceAll('{{CPF}}',cpf).replaceAll('{{ESTUDIO}}',CONFIG.nomeEstudio)}
function updatePreview(){el('contrato').textContent=texto(clean(el('nome').value)||'[NOME DO CLIENTE]',el('cpf').value||'[CPF]')}
el('nome').addEventListener('input',updatePreview);el('cpf').addEventListener('input',updatePreview);updatePreview();setupCanvas();window.addEventListener('resize',()=>{if(!drew)setupCanvas()});
function notice(s,bad=false){el('msg').textContent=s;el('msg').className='notice show '+(bad?'bad':'ok')}
el('finish').onclick=async()=>{
  const nome=clean(el('nome').value),cpf=el('cpf').value;
  if(nome.length<5||!nome.includes(' '))return notice('Digite nome e sobrenome.',true);
  if(!cpfValido(cpf))return notice('CPF inválido. Confira os números.',true);
  if(!drew)return notice('Faça sua assinatura no quadro branco.',true);
  if(!el('aceito').checked)return notice('Confirme que leu e concorda com o contrato.',true);
  if(!window.FotoProPDF)return notice('Arquivo pdf-local.js não encontrado. Envie os dois arquivos ao GitHub.',true);
  try{
    el('finish').disabled=true;
    pdfBlob=await window.FotoProPDF.create({texto:texto(nome,cpf),nome,cpf,assinatura:canvas.toDataURL('image/png'),estudio:CONFIG.nomeEstudio});
    pdfName='Contrato_'+nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').slice(0,55)+'.pdf';
    el('resultado').classList.remove('hidden');
    el('resultado').scrollIntoView({behavior:'smooth'});
    notice('PDF gerado com sucesso! Baixe a sua cópia e envie por e-mail.');
  }catch(err){console.error(err);notice('Erro ao criar PDF. Confira se pdf-local.js está na mesma pasta de index.html.',true)}
  finally{el('finish').disabled=false}
};
function baixar(){if(!pdfBlob)return;let u=URL.createObjectURL(pdfBlob),a=document.createElement('a');a.href=u;a.download=pdfName;a.click();setTimeout(()=>URL.revokeObjectURL(u),4000)}el('baixar').onclick=baixar;
el('compartilhar').onclick=async()=>{
  if(!pdfBlob)return;
  const arquivo = new File([pdfBlob], pdfName, {type:'application/pdf'});
  const aviso = 'Escolha Gmail ou outro app de e-mail na lista de compartilhamento e CONFIRME o envio. O FotoPro nao verifica se o e-mail foi enviado.';
  if (navigator.share && navigator.canShare && navigator.canShare({files:[arquivo]})) {
    try {
      await navigator.share({files:[arquivo], title:'Contrato assinado em PDF', text:'Contrato assinado para '+CONFIG.nomeEstudio});
      notice('Compartilhamento aberto. Confira no aplicativo escolhido se o arquivo esta anexado e confirme o envio.');
      return;
    } catch(err) {
      if(err.name==='AbortError') {notice('Compartilhamento cancelado. Voce ainda pode baixar o PDF.'); return;}
      console.error(err);
    }
  }
  baixar();
  notice('Seu navegador nao permite anexar diretamente ao compartilhar. O PDF foi baixado: abra seu e-mail, crie uma mensagem para '+CONFIG.emailDestino+' e adicione o arquivo em Anexar.',true);
};
