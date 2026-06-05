async function run() {
  const url = "https://res.cloudinary.com/dbtlfrvs0/image/upload/v1780592602/certificates/c2589d0c5e9fd01dcf32f0051c3cfe2f_kl81zh.pdf";
  console.log("Fetching URL:", url);
  try {
    const res = await fetch(url);
    console.log("Response status:", res.status);
    console.log("Response OK:", res.ok);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}
run();
