'use strict';

// Video-only master. The audio is joined separately on its original PCM clock.
async function startUhdExport(fps) {
  const {Output, Mp4OutputFormat, BufferTarget, EncodedVideoPacketSource, EncodedPacket}=Mediabunny;
  const scene=document.querySelector('#view');
  const {width,height}=scene;
  const average=new OffscreenCanvas(width,height);
  const shutter=average.getContext('2d',{alpha:false});
  const source=new EncodedVideoPacketSource('avc');
  const file=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target:new BufferTarget()});
  file.addVideoTrack(source,{frameRate:fps});
  await file.start();
  let encoded=0, pending=Promise.resolve(), fault;
  const encoder=new VideoEncoder({
    output(chunk,meta) {
      const packet=EncodedPacket.fromEncodedChunk(chunk);
      pending=pending.then(()=>source.add(packet,meta)).catch(error=>{fault=error;});
      encoded++;
    },
    error(error){fault=error;}
  });
  const config={codec:'avc1.640034',width,height,bitrate:150_000_000,framerate:fps,
    hardwareAcceleration:'prefer-hardware',latencyMode:'realtime',avc:{format:'avc'}};
  if(!(await VideoEncoder.isConfigSupported(config)).supported)throw Error('UHD H.264 is unavailable');
  encoder.configure(config);

  function clear(ctx,w,h) {
    ctx.globalAlpha=1;ctx.globalCompositeOperation='copy';
    ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.25;
  }
  function calibrate() {
    const tile=new OffscreenCanvas(4,4), ctx=tile.getContext('2d',{alpha:false});
    return [0,1,2].map(group=>{
      clear(ctx,4,4);
      for(let sub=0;sub<4;sub++){
        const value=80*group+20*sub;
        ctx.fillStyle='rgb('+value+','+value+','+value+')';ctx.fillRect(0,0,4,4);
      }
      return ctx.getImageData(0,0,1,1).data[0];
    });
  }
  const levels=calibrate();
  if(levels.some((value,i)=>Math.abs(value-(30+80*i))>1))throw Error('Shutter calibration failed: '+levels);

  async function frames(start,end,base=0) {
    for(let i=start;i<end;i++) {
      clear(shutter,width,height);
      for(let sub=0;sub<4;sub++){
        // A fifth of a frame (72 degrees) retains the fine printing cuts during a flyby.
        const offset=(sub-1.5)*.20/(4*fps);
        seek((base+i/fps+offset+motion.duration)%motion.duration);
        shutter.drawImage(scene,0,0);
      }
      const timestamp=Math.round(i/fps*1e6), next=Math.round((i+1)/fps*1e6);
      const frame=new VideoFrame(average,{timestamp,duration:next-timestamp});
      encoder.encode(frame,{keyFrame:i%(2*fps)===0});
      frame.close();
      if(encoder.encodeQueueSize>12){await encoder.flush();await pending;}
      if(fault)throw fault;
    }
    await pending;
    if(fault)throw fault;
  }

  async function finish() {
    await encoder.flush();encoder.close();
    await pending;
    if(fault)throw fault;
    source.close();await file.finalize();
    const url=URL.createObjectURL(new Blob([file.target.buffer],{type:'video/mp4'}));
    const link=document.createElement('a');
    link.href=url;link.download='picture.mp4';link.click();
    return {frames:encoded,levelCheck:levels,codec:config.codec,bytes:file.target.buffer.byteLength};
  }
  return {frames,finish};
}
