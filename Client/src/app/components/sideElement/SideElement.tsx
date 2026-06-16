

const SideElement = ({ video_url, title, difficulty, category, question, tip }) => {
 return (
  <>
   <div>
    <video controls src={video_url} />
   </div>
   <div className='flex'>
    <p className='font-mono font-bold'> {title} </p>

    <p className='rounded text-center bg-lime-300'>{difficulty}</p>
   </div>
   <div>
    <p className='rounded text-center bg-cyan-200' >{category}</p>
   </div>
   <div>
    {question}
   </div>
   <div className='mb-2' >
    Tip
    <p className='text-xs whitespace-break-spaces text-slate-600'>
     {tip}
    </p>
   </div>
  </>
 );

}


export default SideElement