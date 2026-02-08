import { createUploadthing, type FileRouter } from 'uploadthing/server';

const f = createUploadthing();

export const ourFileRouter = {
  // Post image uploads (up to 4 images per post)
  postImage: f({
    image: { maxFileSize: '4MB', maxFileCount: 4 },
  }).onUploadComplete(({ file }) => {
    console.log('Post image uploaded:', file.ufsUrl);
    return { url: file.ufsUrl };
  }),

  // Avatar upload (single image)
  avatarUpload: f({
    image: { maxFileSize: '2MB', maxFileCount: 1 },
  }).onUploadComplete(({ file }) => {
    console.log('Avatar uploaded:', file.ufsUrl);
    return { url: file.ufsUrl };
  }),

  // Submission attachments (images + pdfs)
  submissionAttachment: f({
    image: { maxFileSize: '4MB', maxFileCount: 4 },
    pdf: { maxFileSize: '8MB', maxFileCount: 2 },
  }).onUploadComplete(({ file }) => {
    console.log('Submission attachment uploaded:', file.ufsUrl);
    return { url: file.ufsUrl };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
