export interface TapPointer {pointerId:number;clientX:number;clientY:number;isPrimary?:boolean;button?:number}
/** A touch/pointer gesture becomes a click only if it remained a single 6px tap. */
export class LivingTapGate {
 private pointers=new Set<number>();private armed=false;private start={x:0,y:0,id:-1};
 get count(){return this.pointers.size;}
 down(event:TapPointer,enabled:boolean){this.pointers.add(event.pointerId);this.armed=enabled&&this.pointers.size===1&&event.isPrimary===true&&event.button===0;this.start={x:event.clientX,y:event.clientY,id:event.pointerId};}
 move(event:TapPointer){if(Math.hypot(event.clientX-this.start.x,event.clientY-this.start.y)>6)this.armed=false;}
 up(event:TapPointer,enabled:boolean){const accepted=this.armed&&enabled&&this.pointers.size===1&&event.pointerId===this.start.id&&Math.hypot(event.clientX-this.start.x,event.clientY-this.start.y)<=6;this.pointers.delete(event.pointerId);this.armed=false;return accepted;}
 cancel(id?:number){if(id!==undefined)this.pointers.delete(id);this.armed=false;}
 reset(){this.pointers.clear();this.armed=false;}
}
