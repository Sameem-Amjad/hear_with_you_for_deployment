import {
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/currentuser.decorator';
import { FirebaseAuthGuard } from '../../common/guards/firebaseauth.guard';
import { SetupProfileDto } from './dto/setupprofile.dto';
import { UpdateProfileDto } from './dto/updateprofile.dto';
import { UserService } from './user.service';
import { Body } from '@nestjs/common';
import { API_PATHS } from '../../common/constants/api.paths';
import { SWAGGER_META } from '../../common/constants/swagger.meta';

const multerOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
};

@ApiTags(SWAGGER_META.TAGS.USER)
@ApiBearerAuth('firebaseauth')
@UseGuards(FirebaseAuthGuard)
@Controller(API_PATHS.USER.PROFILE_ROOT)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post(API_PATHS.USER.PROFILE_SETUP)
  @UseInterceptors(FileInterceptor('profilePicture', multerOptions))
  @ApiOperation({
    summary: SWAGGER_META.USER.SETUP_PROFILE.SUMMARY,
    description: SWAGGER_META.USER.SETUP_PROFILE.DESCRIPTION,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: SetupProfileDto })
  async setupProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: SetupProfileDto,
    @UploadedFile() profilePicture?: Express.Multer.File,
  ) {
    return this.userService.setupProfile(user.id, dto, profilePicture);
  }

  @Get()
  @ApiOperation({
    summary: SWAGGER_META.USER.GET_PROFILE.SUMMARY,
    description: SWAGGER_META.USER.GET_PROFILE.DESCRIPTION,
  })
  async getCurrentProfile(@CurrentUser() user: { id: string }) {
    return this.userService.getCurrentProfile(user.id);
  }

  @Patch()
  @UseInterceptors(FileInterceptor('profilePicture', multerOptions))
  @ApiOperation({
    summary: SWAGGER_META.USER.UPDATE_PROFILE.SUMMARY,
    description: SWAGGER_META.USER.UPDATE_PROFILE.DESCRIPTION,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateProfileDto })
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
    @UploadedFile() profilePicture?: Express.Multer.File,
  ) {
    return this.userService.updateProfile(user.id, dto, profilePicture);
  }
}
