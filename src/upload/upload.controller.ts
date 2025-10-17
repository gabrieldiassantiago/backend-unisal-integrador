import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  // Upload simples de imagem
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const result = await this.uploadService.uploadFile(file, 'images');
    return {
      success: true,
      message: 'Image uploaded successfully',
      data: result,
    };
  }

  // Upload de foto de perfil de paciente
  @Post('paciente/perfil')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPerfilPaciente(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('pacienteId') pacienteId: string,
  ) {
    const result = await this.uploadService.uploadFile(
      file,
      `pacientes/${pacienteId}/perfil`,
    );
    return {
      success: true,
      message: 'Profile picture uploaded',
      data: result,
    };
  }

  // Upload múltiplo de documentos
  @Post('paciente/documentos')
  @UseInterceptors(FilesInterceptor('files', 5)) // máximo 5 arquivos
  async uploadDocumentosPaciente(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
        ],
      }),
    )
    files: Express.Multer.File[],
    @Body('pacienteId') pacienteId: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const results = await this.uploadService.uploadMultipleFiles(
      files,
      `pacientes/${pacienteId}/documentos`,
    );

    return {
      success: true,
      message: `${results.length} documents uploaded`,
      data: results,
    };
  }

  // Upload de gráfico de sensor
  @Post('sensor/grafico')
  @UseInterceptors(FileInterceptor('file'))
  async uploadGraficoSensor(
    @UploadedFile() file: Express.Multer.File,
    @Body('deviceId') deviceId: string,
  ) {
    const result = await this.uploadService.uploadFile(
      file,
      `sensores/${deviceId}/graficos`,
    );
    return {
      success: true,
      data: result,
    };
  }

  // Deletar arquivo
  @Delete('file')
  async deleteFile(@Body('fileName') fileName: string) {
    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }

    const result = await this.uploadService.deleteFile(fileName);
    return {
      success: true,
      message: 'File deleted successfully',
      data: result,
    };
  }
}
