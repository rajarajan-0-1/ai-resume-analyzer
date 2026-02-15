import { type FormEvent, useState } from "react";
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import { usePuterStore } from "~/lib/puter";
import { useNavigate } from "react-router";
import { convertPdfToImage } from "~/lib/pdf2img";
import { generateUUID } from "~/lib/utils";
import { prepareInstructions, AIResponseFormat } from "../../constants";

const Upload = () => {
  const { fs, ai, kv } = usePuterStore();
  const navigate = useNavigate();

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleFileSelect = (selectedFile: File | null) => {
    setFile(selectedFile);
  };

  const handleAnalyze = async ({
    companyName,
    jobTitle,
    jobDescription,
    file,
  }: {
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    file: File;
  }) => {
    try {
      setIsProcessing(true);

      // 1️⃣ Upload Resume
      setStatusText("Uploading resume...");
      const uploadedFile = await fs.upload([file]);

      if (!uploadedFile || !uploadedFile.path) {
        throw new Error("Resume upload failed");
      }

      console.log("Resume uploaded:", uploadedFile.path);

      // 2️⃣ Convert PDF to Image
      setStatusText("Converting resume to image...");
      console.log("Starting PDF conversion");

      const imageFile = await convertPdfToImage(file);

      console.log("Conversion result:", imageFile);

      if (!imageFile || !imageFile.file) {
        throw new Error("PDF conversion failed");
      }

      // 3️⃣ Upload Image
      setStatusText("Uploading image...");
      const uploadedImage = await fs.upload([imageFile.file]);

      if (!uploadedImage || !uploadedImage.path) {
        throw new Error("Image upload failed");
      }

      console.log("Image uploaded:", uploadedImage.path);

      // 4️⃣ Prepare Data
      setStatusText("Preparing data...");
      const uuid = generateUUID();

      const data: any = {
        id: uuid,
        resumePath: uploadedFile.path,
        imagePath: uploadedImage.path,
        companyName,
        jobTitle,
        jobDescription,
        feedback: "",
      };

      await kv.set(`resume:${uuid}`, JSON.stringify(data));

      // 5️⃣ AI Analysis
      setStatusText("Analyzing resume with AI...");

      const feedback = await ai.feedback(
        uploadedFile.path,
        prepareInstructions({
          jobTitle,
          jobDescription,
          AIResponseFormat,
        })
      );

      if (!feedback) {
        throw new Error("AI analysis failed");
      }

      const feedbackText =
        typeof feedback.message.content === "string"
          ? feedback.message.content
          : feedback.message.content[0].text;

      console.log("Raw AI response:", feedbackText);

      // ✅ Safe JSON Parsing
      let parsedFeedback;
      try {
        const cleanedText = feedbackText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        parsedFeedback = JSON.parse(cleanedText);
      } catch (err) {
        console.error("Invalid JSON from AI:", feedbackText);
        throw new Error("AI returned invalid JSON");
      }

      data.feedback = parsedFeedback;

      await kv.set(`resume:${uuid}`, JSON.stringify(data));

      setStatusText("Analysis complete. Redirecting...");

      navigate(`/resume/${uuid}`);
    } catch (error) {
      console.error("Error during process:", error);
      setStatusText("Something went wrong. Check console.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    const formData = new FormData(form);

    const companyName = formData.get("company-name") as string;
    const jobTitle = formData.get("job-title") as string;
    const jobDescription = formData.get("job-description") as string;

    if (!file) {
      alert("Please upload a resume file");
      return;
    }

    handleAnalyze({ companyName, jobTitle, jobDescription, file });
  };

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover">
      <Navbar />

      <section className="main-section">
        <div className="page-heading py-16">
          <h1>Smart feedback for your dream job</h1>

          {isProcessing ? (
            <>
              <h2>{statusText}</h2>
              <img
                src="/images/resume-scan.gif"
                className="w-full"
                alt="Processing"
              />
            </>
          ) : (
            <h2>
              Drop your resume for an ATS score and improvement tips
            </h2>
          )}

          {!isProcessing && (
            <form
              id="upload-form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 mt-8"
            >
              <div className="form-div">
                <label htmlFor="company-name">Company Name</label>
                <input
                  type="text"
                  name="company-name"
                  placeholder="Company Name"
                  id="company-name"
                />
              </div>

              <div className="form-div">
                <label htmlFor="job-title">Job Title</label>
                <input
                  type="text"
                  name="job-title"
                  placeholder="Job Title"
                  id="job-title"
                />
              </div>

              <div className="form-div">
                <label htmlFor="job-description">Job Description</label>
                <textarea
                  rows={5}
                  name="job-description"
                  placeholder="Job Description"
                  id="job-description"
                />
              </div>

              <div className="form-div">
                <label>Upload Resume</label>
                <FileUploader onFileSelect={handleFileSelect} />
              </div>

              <button className="primary-button" type="submit">
                Analyze Resume
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
};

export default Upload;