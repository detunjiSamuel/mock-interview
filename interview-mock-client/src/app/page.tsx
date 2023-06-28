import Image from 'next/image'

export default function Home() {
 return (
  <main className="flex min-h-screen flex-col  p-24">

   <section>
    <h2 className="font-mono font-bold">
     Perfect your interview performance.
     <span className="font-mono font-bold"></span>
    </h2>
    <p className="text-gray-800">
     Select a question or topic to practice. Our AI will ask you questions
     and give you feedback instantly to help you ace your next interview.
    </p>
   </section>

   {/** questions and companies section */}

   <section className="flex">

    <div className="flex-auto w-64 bg-blue-100 mr-4 card " >
     {/* Questions Section */}

     <table className="table-auto">
      <thead>
       <tr>
        <th>STATUS</th>
        <th>TOPIC</th>
        <th>DIFFICULTY</th>
        <th>CATEGORY</th>
       </tr>
      </thead>
      <tbody>
       <tr>
        <td>01</td>
        <td>The Sliding Mr. Bones (Next Stop, Pottersville)</td>
        <td>MEDIUM</td>
        <td>BEHAVIOURAL</td>
       </tr>
       <tr>
       <td>01</td>
        <td>The Sliding Mr. Bones (Next Stop, Pottersville)</td>
        <td>MEDIUM</td>
        <td>BEHAVIOURAL</td>
       </tr>
       <tr>
       <td>01</td>
        <td>The Sliding Mr. Bones (Next Stop, Pottersville)</td>
        <td>MEDIUM</td>
        <td>BEHAVIOURAL</td>
       </tr>
      </tbody>
     </table>
    </div>

    <div className=" flex-auto w-24 bg-red-100 card ">
     Companies Section
    </div>


   </section>



  </main>
 )
}
