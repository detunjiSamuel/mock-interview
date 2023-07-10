import Image from 'next/image'

export default function Home() {
 return (
  <main className="flex flex-row min-h-screen p-2 pt-6">
   <section className='basis-[40%] card'>
    <div>
     Video Prompter goes here
    </div>
    <div>
     Title and difficulty goes here
    </div>
    <div>
     tags go here
    </div>
    <div>
     actual question goes here
    </div>
    <div>
     helpful tips goes here
    </div>
   </section>
   <section className='basis-[60%] flex flex-col space-y-64'>
    <div className="flex flex-row justify-between capitalize text-sm ">
     <div className="underline hover:no-underline">
      hows it works
     </div>
     <div className="underline hover:no-underline">
      view all feedback goes here
     </div>
    </div>
    <div className='flex flex-col w-full items-center space-y-4'>
     <div className='rounded bg-black text-center text-white '>
      <div className="m-6">
       Start Recording your response
      </div>
     </div>
     <div className='text-xs whitespace-break-spaces w-2/4 text-center'>
      Read over the prompt and prepare your response.When you are
      ready, click the button above to start recording.
     </div>
    </div>

   </section>

  </main>
 )
}
