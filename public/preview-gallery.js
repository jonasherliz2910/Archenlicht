// Native horizontal scrolling keeps touch swipes smooth and preserves vertical
// page scrolling. Dots and keyboard provide the same views without touch.
export function mountPreviewGallery(root) {
  if (!root) return;
  const track = root.querySelector('.preview-track'), buttons = [...root.querySelectorAll('[data-preview-slide]')];
  const slides=[...track.querySelectorAll('.preview-slide')],last=slides.length-1;
  let selected = 0, frame;
  function update(index) {
    selected = Math.max(0,Math.min(last,index));
    buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selected)));
    root.querySelector('[data-preview-status]').textContent = slides[selected].getAttribute('aria-label');
  }
  function go(index) {
    update(index);
    track.scrollTo({left:selected*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-preview-slide'))go(Number(button.dataset.previewSlide));
    if(button.hasAttribute('data-preview-previous'))go(selected-1);
    if(button.hasAttribute('data-preview-next'))go(selected+1);
  });
  track.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();go(event.key==='Home'?0:event.key==='End'?last:selected+(event.key==='ArrowRight'?1:-1));
  });
  track.addEventListener('scroll',()=>{
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>update(Math.round(track.scrollLeft/Math.max(1,track.clientWidth))));
  },{passive:true});
  // Keep the selected view aligned after rotation or changing window width.
  const observer=new ResizeObserver(()=>{track.scrollTo({left:selected*track.clientWidth,behavior:'instant'})});observer.observe(track);
  update(0);
  return ()=>{observer.disconnect();cancelAnimationFrame(frame)};
}
