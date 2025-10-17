import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3Client: S3Client;
  private bucket: string;
  private endpoint: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('SPACES_BUCKET');
    this.endpoint = this.configService.get('SPACES_ENDPOINT');

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: this.configService.get('SPACES_REGION'),
      credentials: {
        accessKeyId: this.configService.get('SPACES_KEY'),
        secretAccessKey: this.configService.get('SPACES_SECRET'),
      },
      forcePathStyle: false,
    });

  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
    isPublic: boolean = true,
  ) {
    try {
      const timestamp = Date.now();
      const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${folder}/${timestamp}-${sanitizedFileName}`;

      this.logger.log(`Uploading file: ${fileName}`);

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucket,
          Key: fileName,
          Body: file.buffer,
          ACL: isPublic ? 'public-read' : 'private',
          ContentType: file.mimetype,
          Metadata: {
            originalName: file.originalname,
            uploadDate: new Date().toISOString(),
          },
        },
      });

      await upload.done();

      const fileUrl = `${this.endpoint}/${this.bucket}/${fileName}`;

      this.logger.log(`File uploaded successfully: ${fileUrl}`);

      return {
        url: fileUrl,
        fileName,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      };
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(fileName: string) {
    try {
      this.logger.log(`Deleting file: ${fileName}`);

      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileName,
      });

      await this.s3Client.send(command);

      this.logger.log(`File deleted successfully: ${fileName}`);

      return { success: true, fileName };
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`);
      throw error;
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'uploads',
  ) {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file, folder),
    );
    return Promise.all(uploadPromises);
  }
}
