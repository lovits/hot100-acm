#include <stdio.h>
#include <stdlib.h>


/**
 ** Note: The returned array must be malloced, assume caller calls free().
 **/
int* spiralOrder(int** matrix, int matrixSize, int *matrixColSize, int *returnSize)
{
    if (matrixSize == 0) {
        *returnSize = 0;
        return NULL;
    }

    int hor_top = 0;
    int hor_bottom = matrixSize - 1;
    int ver_left = 0;
    int ver_right = matrixColSize[0] - 1;
    int *nums = malloc(matrixSize * matrixColSize[0] * sizeof(int));
    int count = 0;
    int i, direction = 0;

    while (hor_top <= hor_bottom && ver_left <= ver_right) {
        switch (direction) {
        case 0:
            for (i = ver_left; i <= ver_right; i++) {
                nums[count++] = matrix[hor_top][i];
            }
            hor_top++;
            break;
        case 1:
            for (i = hor_top; i <= hor_bottom; i++) {
                nums[count++] = matrix[i][ver_right];
            }
            ver_right--;
            break;
        case 2:
            for (i = ver_right; i >= ver_left; i--) {
                nums[count++] = matrix[hor_bottom][i];
            }
            hor_bottom--;
            break;
        case 3:
            for (i = hor_bottom; i >= hor_top; i--) {
                nums[count++] = matrix[i][ver_left];
            }
            ver_left++;
            break;
        default:
            break;
        }
        direction++;
        direction %= 4;
    }

    *returnSize = count;
    return nums;
}
